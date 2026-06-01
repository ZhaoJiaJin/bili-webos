import React, { useState, useRef, useCallback } from 'react';
import { storage } from '../utils/storage';
import { useFocusable } from '../hooks/useFocus';
import { getHistory } from '../api/client';
import VideoGrid from '../components/VideoGrid';

export default function SettingsPage({ onLogout, user, onPlayVideo }) {
  const [proxyUrl] = useState(storage.getProxyUrl());
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pullReady, setPullReady] = useState(false);
  const settings = storage.getSettings();
  const refreshingRef = useRef(false);

  async function loadHistory() {
    try {
      const res = await getHistory(0, 0, 12);
      if (res?.data?.list) {
        setHistory(res.data.list.map(item => ({
          bvid: item.history?.bvid, cid: item.history?.cid,
          title: item.title, pic: item.cover, duration: item.duration,
          progress: item.progress, owner: { name: item.author_name },
          stat: { view: item.view, like: item.like },
        })));
      }
    } catch {}
  }

  React.useEffect(() => {
    if (!user) return;
    loadHistory();
  }, [user]);

  const doRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
    refreshingRef.current = false;
  }, []);

  React.useEffect(() => {
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

  const { props: danmakuProps } = useFocusable({
    id: 'content-0-0', row: 0, col: 0, group: 'content',
    onSelect: () => {
      const s = storage.getSettings();
      storage.setSettings({ ...s, danmaku: !s.danmaku });
    },
  });

  const { props: logoutProps } = useFocusable({
    id: 'content-0-1', row: 0, col: 1, group: 'content',
    onSelect: () => { storage.clearAuth(); onLogout(); },
  });

  const PULL_HEIGHT = 64;

  return (
    <div style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
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
        padding: '20px 28px', height: '100%', overflow: 'auto',
        transform: `translateY(${pullReady || refreshing ? PULL_HEIGHT : 0}px)`,
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>

      <div style={{ fontSize: 26, fontWeight: 600, color: '#fff', marginBottom: 20 }}>
        {user ? `${user.uname} 的空间` : '我的'}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div {...danmakuProps} className="detail-btn" style={{ fontSize: 16 }}>
          弹幕: {settings.danmaku ? '开' : '关'}
        </div>
        <div {...logoutProps} className="detail-btn secondary" style={{ fontSize: 16, background: '#4a2020' }}>
          退出登录
        </div>
      </div>

      <div style={{ fontSize: 14, color: '#555', marginBottom: 20 }}>
        代理: {proxyUrl}
      </div>

      {user && history.length > 0 && (
        <>
          <div style={{ fontSize: 20, color: '#aaa', marginBottom: 14 }}>最近观看</div>
          <VideoGrid videos={history} group="content" startRow={1} cols={3} onSelect={onPlayVideo} />
        </>
      )}
    </div>
    </div>
  );
}
