"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";

/**
 * Kanvas tanda tangan, dipakai pengesahan dokumen dan link belanja.
 *
 * Menangani pointer event, bukan mouse dan touch terpisah, supaya goresan jari
 * di ponsel dan mouse di desktop lewat jalur kode yang sama.
 *
 * Di ponsel, event `resize` juga muncul saat keyboard layar terbuka atau
 * tertutup (yang berubah hanya tinggi jendela). Mengatur ulang ukuran kanvas
 * menghapus isinya, jadi kanvas hanya diatur ulang bila lebarnya berubah, dan
 * goresan yang sudah ada digambar ulang.
 */

export interface SignaturePadHandle {
  /** Data URL PNG, atau null bila kanvas masih kosong. */
  toDataUrl: () => string | null;
  clear: () => void;
}

interface SignaturePadProps {
  /** Petunjuk di bawah kotak. */
  hint?: string;
  /** Label kotak untuk pembaca layar. */
  label?: string;
  /** Dipanggil saat kotak berubah dari kosong ke berisi, atau sebaliknya. */
  onChange?: (hasStroke: boolean) => void;
}

const CANVAS_HEIGHT = 200;
const STROKE_WIDTH = 2.5;
const STROKE_COLOR = "#111827";
const DEFAULT_HINT = "Goreskan tanda tangan Anda di kotak di atas.";
const DEFAULT_LABEL = "Kotak tanda tangan";
/** Lebar awal yang pasti berbeda dari lebar nyata, supaya kanvas selalu disiapkan saat dipasang. */
const UNMEASURED_WIDTH = -1;

function applyStrokeStyle(context: CanvasRenderingContext2D, ratio: number) {
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineWidth = STROKE_WIDTH;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = STROKE_COLOR;
}

/** Salinan isi kanvas sebelum ukurannya diatur ulang; null bila gagal. */
function snapshotCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  if (canvas.width === 0 || canvas.height === 0) return null;
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  const copyContext = copy.getContext("2d");
  if (!copyContext) return null;
  copyContext.drawImage(canvas, 0, 0);
  return copy;
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad(
    { hint = DEFAULT_HINT, label = DEFAULT_LABEL, onChange },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const widthRef = useRef(UNMEASURED_WIDTH);
    const hasStrokeRef = useRef(false);
    const onChangeRef = useRef(onChange);
    const [hasStroke, setHasStroke] = useState(false);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    const updateHasStroke = useCallback((value: boolean) => {
      if (hasStrokeRef.current === value) return;
      hasStrokeRef.current = value;
      setHasStroke(value);
      onChangeRef.current?.(value);
    }, []);

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.clientWidth;
      if (width === widthRef.current) return;

      const previousWidth = widthRef.current;
      const snapshot = hasStrokeRef.current ? snapshotCanvas(canvas) : null;
      const ratio = window.devicePixelRatio || 1;
      widthRef.current = width;
      canvas.width = width * ratio;
      canvas.height = CANVAS_HEIGHT * ratio;

      const context = canvas.getContext("2d");
      if (!context) return;
      if (snapshot && previousWidth > 0) {
        // Diperkecil sebanding bila kotak menyempit; tidak diperbesar supaya
        // tanda tangan tidak terpotong di bawah.
        const scale = Math.min(1, width / previousWidth);
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.drawImage(
          snapshot,
          0,
          0,
          snapshot.width * scale,
          snapshot.height * scale,
        );
      }
      applyStrokeStyle(context, ratio);
    }, []);

    useEffect(() => {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      return () => window.removeEventListener("resize", resizeCanvas);
    }, [resizeCanvas]);

    const positionOf = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();

      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const handlePointerDown = (
      event: React.PointerEvent<HTMLCanvasElement>,
    ) => {
      const context = canvasRef.current?.getContext("2d");
      if (!context) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      isDrawingRef.current = true;

      const { x, y } = positionOf(event);
      context.beginPath();
      context.moveTo(x, y);
    };

    const handlePointerMove = (
      event: React.PointerEvent<HTMLCanvasElement>,
    ) => {
      if (!isDrawingRef.current) return;

      const context = canvasRef.current?.getContext("2d");
      if (!context) return;

      const { x, y } = positionOf(event);
      context.lineTo(x, y);
      context.stroke();
      updateHasStroke(true);
    };

    const stopDrawing = () => {
      isDrawingRef.current = false;
    };

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
      updateHasStroke(false);
    }, [updateHasStroke]);

    useImperativeHandle(
      ref,
      () => ({
        toDataUrl: () =>
          hasStroke
            ? (canvasRef.current?.toDataURL("image/png") ?? null)
            : null,
        clear,
      }),
      [clear, hasStroke],
    );

    return (
      <div className="space-y-2">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={hasStroke ? `${label}, sudah diisi` : `${label}, kosong`}
          style={{ height: CANVAS_HEIGHT }}
          className="w-full touch-none rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
          <Button
            type="button"
            variant="ghost"
            onClick={clear}
            className="min-h-[44px] text-sm"
          >
            Ulangi
          </Button>
        </div>
      </div>
    );
  },
);

export default SignaturePad;
