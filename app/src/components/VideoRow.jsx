import React from 'react';
import VideoCard from './VideoCard';

export default React.memo(function VideoRow({ title, videos, rowIndex = 0, group = 'content', onSelect }) {
  if (!videos || videos.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      {title ? <div className="section-title">{title}</div> : null}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {videos.map((video, idx) => {
          const bvid = video.bvid || video.bv_id;
          return (
            <VideoCard
              key={bvid || `vr-${rowIndex}-${idx}`}
              video={video}
              focusId={`${group}-${rowIndex}-${idx}`}
              row={rowIndex}
              col={idx}
              group={group}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
});
