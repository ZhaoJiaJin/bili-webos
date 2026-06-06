import React, { useState, useEffect, useCallback } from 'react';
import { initKeyboardNav, setFocus, onFocusChange } from './hooks/useFocus';
import { getNavInfo } from './api/client';
import { storage } from './utils/storage';
import SidebarItem from './components/SidebarItem';

import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import HistoryPage from './pages/HistoryPage';
import FavoritesPage from './pages/FavoritesPage';
import PlayerPage from './player/PlayerPage';
import LivePlayerPage from './player/LivePlayerPage';

const NAV_ITEMS = [
  { key: 'recommend', label: '推荐', icon: '🏠' },
  { key: 'history', label: '历史', icon: '🕐' },
  { key: 'hot', label: '热门', icon: '🔥' },
  { key: 'live', label: '直播', icon: '📡' },
  { key: 'partition', label: '分区', icon: '📁' },
  { key: 'follow', label: '关注', icon: '👤' },
  { key: 'favorites', label: '收藏', icon: '⭐' },
  { key: 'search', label: '搜索', icon: '🔍' },
];

function Sidebar({ activePage, onPageChange, user, danmakuEnabled, onToggleDanmaku, onLogout }) {
  useEffect(() => {
    return onFocusChange((fid) => {
      if (!fid?.startsWith('sidebar-')) return;
      const match = fid.match(/^sidebar-(\d+)-/);
      if (!match) return;
      const idx = parseInt(match[1]);
      if (idx < NAV_ITEMS.length) {
        onPageChange(NAV_ITEMS[idx].key);
      }
    });
  }, [onPageChange]);

  const danmakuRow = NAV_ITEMS.length;
  const logoutRow = NAV_ITEMS.length + 1;

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h1>B站</h1>
        <span>webOS</span>
      </div>

      <div className="sidebar-nav">
        {NAV_ITEMS.map((item, i) => (
          <SidebarItem
            key={item.key}
            id={`sidebar-${i}-0`}
            row={i}
            label={item.label}
            icon={item.icon}
            active={activePage === item.key}
            onSelect={() => onPageChange(item.key)}
          />
        ))}
      </div>

      <div className="sidebar-user">
        {user ? (
          <>
            <div className="sidebar-user-avatar">
              {user.face && <img src={user.face} alt="" />}
            </div>
            <div className="sidebar-user-name">{user.uname}</div>
          </>
        ) : (
          <div className="sidebar-user-login">未登录</div>
        )}
        <SidebarItem
          id={`sidebar-${danmakuRow}-0`}
          row={danmakuRow}
          label={danmakuEnabled ? '弹幕开' : '弹幕关'}
          icon="💬"
          active={false}
          onSelect={onToggleDanmaku}
        />
        {user && (
          <SidebarItem
            id={`sidebar-${logoutRow}-0`}
            row={logoutRow}
            label="退出"
            icon="🚪"
            active={false}
            onSelect={onLogout}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('recommend');
  const [user, setUser] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [playerVideo, setPlayerVideo] = useState(null);
  const [liveRoom, setLiveRoom] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [toast, setToast] = useState('');
  const [danmakuEnabled, setDanmakuEnabled] = useState(storage.getSettings().danmaku !== false);

  useEffect(() => {
    initKeyboardNav();
    const auth = storage.getAuth();
    if (auth?.SESSDATA) {
      setLoggedIn(true);
      loadUserInfo();
    }
    setTimeout(() => setFocus('content-0-0'), 500);
  }, []);

  useEffect(() => {
    const handleBack = () => {
      if (playerVideo) {
        setPlayerVideo(null);
      } else if (liveRoom) {
        setLiveRoom(null);
      } else if (showLogin) {
        setShowLogin(false);
      } else if (page !== 'history') {
        setPage('history');
      } else {
        try { window.webOS?.platformBack?.(); } catch { window.close(); }
      }
    };
    window.addEventListener('tv-back', handleBack);
    return () => window.removeEventListener('tv-back', handleBack);
  }, [playerVideo, showLogin, page]);

  const loadUserInfo = useCallback(async () => {
    try {
      const res = await getNavInfo();
      if (res?.data?.isLogin) {
        setUser({ mid: res.data.mid, uname: res.data.uname, face: res.data.face });
        setLoggedIn(true);
      }
    } catch (err) {
      console.error('Nav info error:', err);
    }
  }, []);

  const handleLogin = useCallback(() => {
    setShowLogin(false);
    setLoggedIn(true);
    loadUserInfo();
    showToastMsg('登录成功');
    setPage('history');
  }, [loadUserInfo]);

  const handleLogout = useCallback(() => {
    storage.clearAuth();
    setUser(null);
    setLoggedIn(false);
    showToastMsg('已退出登录');
    setPage('history');
  }, []);

  const handleToggleDanmaku = useCallback(() => {
    setDanmakuEnabled(prev => {
      const next = !prev;
      storage.setSettings({ ...storage.getSettings(), danmaku: next });
      return next;
    });
  }, []);

  const handlePlayVideo = useCallback((video) => {
    if (video?.isLive && video?.roomid) {
      setLiveRoom(video);
      return;
    }
    if (!video?.bvid) { showToastMsg('无法播放此视频'); return; }
    setPlayerVideo(video);
  }, []);

  const handlePageChange = useCallback((key) => {
    if (key === 'follow' && !loggedIn) {
      setShowLogin(true);
      return;
    }
    setPage(key);
  }, [loggedIn]);

  const showToastMsg = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  return (
    <>
      <div className="app-container" style={{ display: (playerVideo || liveRoom) ? 'none' : 'flex' }}>
        <Sidebar
          activePage={page}
          onPageChange={handlePageChange}
          user={user}
          danmakuEnabled={danmakuEnabled}
          onToggleDanmaku={handleToggleDanmaku}
          onLogout={handleLogout}
        />
        <div className="main-content">
          {page === 'history' && <HistoryPage onPlayVideo={handlePlayVideo} />}
          {page === 'recommend' && <HomePage onPlayVideo={handlePlayVideo} mode="recommend" />}
          {page === 'hot' && <HomePage onPlayVideo={handlePlayVideo} mode="hot" />}
          {page === 'live' && <HomePage onPlayVideo={handlePlayVideo} mode="live" />}
          {page === 'partition' && <HomePage onPlayVideo={handlePlayVideo} mode="partition" />}
          {page === 'follow' && <HomePage onPlayVideo={handlePlayVideo} mode="follow" />}
          {page === 'favorites' && <FavoritesPage userMid={user?.mid} onPlayVideo={handlePlayVideo} />}
          {page === 'search' && <SearchPage onPlayVideo={handlePlayVideo} />}
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>

      {playerVideo && <PlayerPage key={playerVideo.bvid} video={playerVideo} onBack={() => setPlayerVideo(null)} onPlayNext={(v) => setPlayerVideo(v)} />}
      {liveRoom && <LivePlayerPage key={liveRoom.roomid} room={liveRoom} onBack={() => setLiveRoom(null)} />}

      {showLogin && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: 1920, height: 1080, zIndex: 200, background: '#0d0d1a' }}>
          <LoginPage onLogin={handleLogin} />
        </div>
      )}
    </>
  );
}
