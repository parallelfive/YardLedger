import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// Desktop webcam capture for the seller ID photo. Opens the counter webcam,
// grabs a single JPEG frame to a data URL, and hands it back. Web-only DOM (the
// mobile flow uses the device camera via expo-image-picker instead). The photo
// is stored in the private customer-ids bucket by createReceipt.
export default function CameraCapture({
  title = 'Capture ID photo',
  onCapture,
  onClose,
}: {
  title?: string;
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const nav = navigator as Navigator;
    if (!nav.mediaDevices?.getUserMedia) {
      setErr('No camera available on this device.');
      return;
    }
    nav.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled)
          setErr('Camera blocked. Allow camera access and try again.');
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    // Moderate quality keeps the base64 payload small enough to upload quickly
    // while staying legible for a compliance record.
    setShot(canvas.toDataURL('image/jpeg', 0.7));
  };

  const use = () => {
    if (shot) onCapture(shot);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--ink)',
            }}
          >
            <Icon name="scan" size={18} color="var(--accent)" stroke={2} />
            {title}
          </div>
          <button
            className="tap"
            onClick={onClose}
            style={{ display: 'flex', color: 'var(--ink-3)' }}
          >
            <Icon name="x" size={20} color="var(--ink-3)" stroke={2} />
          </button>
        </div>

        <div
          style={{
            aspectRatio: '16 / 9',
            background: '#000',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {err ? (
            <div
              style={{
                color: 'var(--ink-2)',
                fontSize: 13.5,
                textAlign: 'center',
                padding: 24,
              }}
            >
              {err}
            </div>
          ) : shot ? (
            <img
              src={shot}
              alt="Captured ID"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: 16 }}>
          {shot ? (
            <>
              <button
                className="tap"
                onClick={() => setShot(null)}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Retake
              </button>
              <button
                className="tap"
                onClick={use}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: 12,
                  background: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent-ink)',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Use photo
              </button>
            </>
          ) : (
            <button
              className="tap"
              onClick={capture}
              disabled={!!err}
              style={{
                flex: 1,
                padding: '13px',
                borderRadius: 12,
                background: err ? 'var(--surface)' : 'var(--accent)',
                border: `1px solid ${err ? 'var(--line)' : 'var(--accent)'}`,
                color: err ? 'var(--ink-3)' : 'var(--accent-ink)',
                fontSize: 14,
                fontWeight: 700,
                opacity: err ? 0.6 : 1,
              }}
            >
              Capture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
