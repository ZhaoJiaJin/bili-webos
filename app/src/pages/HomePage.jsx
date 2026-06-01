import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getPopular, getRecommend, getRegionDynamic, getFollowFeed, getLiveList } from '../api/client';
import VideoGrid from '../components/VideoGrid';
import { getCurrentFocusId, setFocus, onFocusChange } from '../hooks/useFocus';

const COLS = 3;
const FETCH_SIZE = 20;

// Module-level cache: persists across page switches for the session
const pageCache = new Map();

async function fetchByMode(mode, pn) {
  if (mode === 'hot') {
    const res = await getPopular(pn, FETCH_SIZE);
    return res?.data?.list || [];
  } else if (mode === 'live') {
    const res = await getLiveList(pn, FETCH_SIZE);
    const items = res?.data?.list || res?.data?.recommend_room_list || [];
    return items.map(item => ({
      bvid: `live-${item.roomid}`,
      title: item.title,
      pic: item.cover || item.system_cover,
      owner: { name: item.uname },
      stat: { view: item.online || item.watched_show?.num },
      isLive: true,
      roomid: item.roomid,
    }));
  } else if (mode === 'partition') {
    const rids = [1, 3, 4, 5, 17, 36, 160, 188, 211];
    const rid = rids[Math.floor(Math.random() * rids.length)];
    const res = await getRegionDynamic(rid, pn, FETCH_SIZE);
    return res?.data?.archives || [];
  } else if (mode === 'follow') {
    const res = await getFollowFeed(pn, FETCH_SIZE);
    return (res?.data?.items || []).map(item => {
      const archive = item.modules?.module_dynamic?.major?.archive;
      if (!archive) return null;
      return {
        bvid: archive.bvid, title: archive.title, pic: archive.cover,
        duration: archive.duration_text, pubdate: archive.pubdate,
        owner: { name: item.modules?.module_author?.name },
        stat: { view: archive.stat?.play, like: archive.stat?.like },
      };
    }).filter(Boolean);
  } else {
    const res = await getRecommend(4, FETCH_SIZE);
    return res?.data?.item || [];
  }
}

export default function HomePage({ onPlayVideo, mode = 'recommend' }) {
  const cached = pageCache.get(mode);
  const [videos, setVideos] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [pullReady, setPullReady] = useState(false);
  const [focusRow, setFocusRow] = useState(0);
  const pageRef = useRef(cached ? 2 : 1);
  const seenRef = useRef(new Set(cached ? cached.map(v => v.bvid || v.bv_id).filter(Boolean) : []));
  const fetchingRef = useRef(false);
  const refreshingRef = useRef(false);

  function dedupe(items) {
    return items.filter(v => {
      const id = v.bvid || v.bv_id;
      if (!id || seenRef.current.has(id)) return false;
      seenRef.current.add(id);
      return true;
    });
  }

  // Initial load — skipped if cache exists
  useEffect(() => {
    if (pageCache.has(mode)) {
      setTimeout(() => {
        const cur = getCurrentFocusId();
        if (!cur || !cur.startsWith('sidebar-')) setFocus('content-0-0');
      }, 50);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchByMode(mode, 1).then(items => {
      if (cancelled) return;
      const deduped = dedupe(items);
      setVideos(deduped);
      pageCache.set(mode, deduped);
      pageRef.current = 2;
      setLoading(false);
      setTimeout(() => {
        const cur = getCurrentFocusId();
        if (!cur || !cur.startsWith('sidebar-')) setFocus('content-0-0');
      }, 50);
    }).catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [mode]);

  // Pull-to-refresh
  const doRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    seenRef.current = new Set();
    pageRef.current = 1;
    pageCache.delete(mode);
    try {
      const items = await fetchByMode(mode, 1);
      const deduped = dedupe(items);
      setVideos(deduped);
      pageCache.set(mode, deduped);
      pageRef.current = 2;
      setFocusRow(0);
      setFocus('content-0-0');
    } catch {}
    setRefreshing(false);
    refreshingRef.current = false;
  }, [mode]);

  useEffect(() => {
    const onReady = () => setPullReady(true);
    const onCancel = () => setPullReady(false);
    const onRefresh = () => { setPullReady(false); doRefresh(); };
    window.addEventListener('pull-ready', onReady);
    window.addEventListener('pull-cancel', onCancel);
    window.addEventListener('pull-to-refresh', onRefresh);
    return () => {
      window.removeEventListener('pull-ready', onReady);
      window.removeEventListener('pull-cancel', onCancel);
      window.removeEventListener('pull-to-refresh', onRefresh);
    };
  }, [doRefresh]);

  // Track focus row for GPU scroll + load more
  useEffect(() => {
    return onFocusChange((fid) => {
      if (!fid) return;
      const m = fid.match(/^content-(\d+)-/);
      if (!m) return;
      const row = parseInt(m[1]);
      setFocusRow(row);

      const totalRows = Math.ceil(videos.length / COLS);
      if (row >= totalRows - 2 && !fetchingRef.current) {
        fetchingRef.current = true;
        fetchByMode(mode, pageRef.current).then(items => {
          const unique = dedupe(items);
          if (unique.length > 0) {
            setVideos(prev => {
              const next = [...prev, ...unique];
              pageCache.set(mode, next);
              return next;
            });
          }
          pageRef.current++;
          fetchingRef.current = false;
        }).catch(() => { fetchingRef.current = false; });
      }
    });
  }, [videos.length, mode]);

  if (loading) {
    return <div className="loading"><div className="loading-spinner" />加载中...</div>;
  }

  const PULL_HEIGHT = 64;

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {(pullReady || refreshing) && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: PULL_HEIGHT,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          color: '#00a1d6', fontSize: 18,
        }}>
          {refreshing
            ? <><div className="loading-spinner" style={{ width: 24, height: 24 }} />正在刷新...</>
            : <>↑ 再次上滑刷新</>}
        </div>
      )}

      {/* Content shifts down to reveal indicator */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        transform: `translateY(${pullReady || refreshing ? PULL_HEIGHT : 0}px)`,
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <VideoGrid
          videos={videos}
          group="content"
          startRow={0}
          cols={COLS}
          onSelect={onPlayVideo}
          focusRow={focusRow}
        />
      </div>
    </div>
  );
}
