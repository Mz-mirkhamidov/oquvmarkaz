"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, RotateCcw, Check, SwitchCamera } from "lucide-react";

import { Button } from "@/components/ui/button";

type Phase = "requesting" | "live" | "denied" | "preview";

export function CameraSheet({
  open,
  childName,
  onCapture,
  onSkip,
  onClose,
}: {
  open: boolean;
  childName: string;
  onCapture: (blob: Blob) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("requesting");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setPhase("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPhase("live");
      } catch {
        if (!cancelled) setPhase("denied");
      }
    }

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facingMode]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase("preview");
      },
      "image/jpeg",
      0.92,
    );
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedBlob(null);
    setPhase("live");
  }

  function confirm() {
    if (capturedBlob) onCapture(capturedBlob);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <button type="button" onClick={onClose} aria-label="Yopish">
          <X className="size-6" aria-hidden />
        </button>
        <span className="text-[16px] font-medium">{childName}</span>
        <span className="size-6" />
      </div>

      <div className="relative flex-1 overflow-hidden">
        {phase === "denied" ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-white">
            <Camera className="size-10 text-white/60" aria-hidden />
            <p className="text-[15px]">
              Kameraga ruxsat berilmadi. Rasmsiz ham davomatni belgilash mumkin.
            </p>
            <Button variant="secondary" onClick={onSkip}>
              Rasmsiz belgilash
            </Button>
          </div>
        ) : phase === "preview" && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a captured Blob URL, not an optimizable remote asset
          <img src={previewUrl} alt="Olingan rasm" className="size-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="size-full object-cover"
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-8 p-6">
        {phase === "live" && (
          <>
            <span className="size-12" />
            <button
              type="button"
              onClick={capture}
              aria-label="Suratga olish"
              className="flex size-20 items-center justify-center rounded-(--r-full) border-4 border-white bg-white/20"
            >
              <span className="size-16 rounded-(--r-full) bg-white" />
            </button>
            <button
              type="button"
              onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
              aria-label="Kamerani almashtirish"
              className="flex size-12 items-center justify-center rounded-(--r-full) bg-white/10 text-white"
            >
              <SwitchCamera className="size-5" aria-hidden />
            </button>
          </>
        )}

        {phase === "preview" && (
          <div className="flex w-full gap-3">
            <Button variant="secondary" className="flex-1" onClick={retake}>
              <RotateCcw className="size-[18px]" aria-hidden />
              Qayta olish
            </Button>
            <Button className="flex-1" onClick={confirm}>
              <Check className="size-[18px]" aria-hidden />
              Tasdiqlash
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
