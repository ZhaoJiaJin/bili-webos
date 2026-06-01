import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getHistory } from '../api/client';
import VideoGrid from '../components/VideoGrid';
import { onFocusChange } from '../hooks/useFocus';

export default function HistoryPage({ onPlayVideo }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullReady, setPullReady] = useState(false);
  const [error, setError] = useState('');
  const [focusRow, setFocusRow] = useState(0);
  const refreshingRef = useRef(false);

  async function load(isRefresh = false) {
    try {
      const res = await getHistory(0, 0, 24);
      if (res?.code === -101) { setError('请先登录'); return; }
      if (res?.data?.list) {
        const items = res.data.list.map(item => ({
          bvid: item.history?.bvid, cid: item.history?.cid,
          title: item.title, pic: item.cover, duration: item.duration,
          progress: item.progress,
          owner: { name: item.author_name },
          stat: { view: item.view, like: item.like },
        }));
        setVideos(items);
        if (!isRefresh) setError('');
      } else {
        setError(res?.message || '加载失败');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => { if (!cancelled) { setLoading(false); setError('加载超时'); } }, 10000);
    load().finally(() => { if (!cancelled) { setLoading(false); clearTimeout(timeout); } });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  const doRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
    refreshingRef.current = false;
  }, []);

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

  useEffect(() => {
    return onFocusChange((fid) => {
      const m = fid?.match(/^content-(\d+)-/);
      if (m) setFocusRow(parseInt(m[1]));
    });
  }, []);

  if (loading) return <div className="loading"><div className="loading-spinner" />加载中...</div>;
  if (error) return <div><div className="page-title">历史记录</div><div className="empty-state">{error}</div></div>;

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
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        transform: `translateY(${pullReady || refreshing ? PULL_HEIGHT : 0}px)`,
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <VideoGrid videos={videos} group="content" startRow={0} onSelect={onPlayVideo} focusRow={focusRow} />
      </div>
    </div>
  );
}
