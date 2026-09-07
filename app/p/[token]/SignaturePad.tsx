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
 * Kanvas tanda tangan.
 *
 * Menangani pointer event, bukan mouse dan touch terpisah, supaya goresan jari
 * di ponsel dan mouse di desktop lewat jalur kode yang sama.
 */

export interface SignaturePadHandle {
  /** Data URL PNG, atau null bila kanvas masih kosong. */
  toDataUrl: () => string | null;
  clear: () => void;
}

const CANVAS_HEIGHT = 200;
const STROKE_WIDTH = 2.5;
const STROKE_COLOR = "#111827";

const SignaturePad = forwardRef<SignaturePadHandle>(
  function SignaturePad(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const [hasStroke, setHasStroke] = useState(false);

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;

      canvas.width = width * ratio;
      canvas.height = CANVAS_HEIGHT * ratio;

      const context = canvas.getContext("2d");
      if (!context) return;

      context.scale(ratio, ratio);
      context.lineWidth = STROKE_WIDTH;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = STROKE_COLOR;
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
      setHasStroke(true);
    };

    const stopDrawing = () => {
      isDrawingRef.current = false;
    };

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      context.clearRect(0, 0, canvas.width, canvas.height);
      setHasStroke(false);
    }, []);

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
          style={{ height: CANVAS_HEIGHT }}
          className="w-full touch-none rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Goreskan tanda tangan Anda di kotak di atas.
          </p>
          <Button variant="ghost" onClick={clear} className="text-sm">
            Ulangi
          </Button>
        </div>
      </div>
    );
  },
);

export default SignaturePad;
