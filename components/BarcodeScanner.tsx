'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null);
  const containerId = 'amg-barcode-scanner';
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let scanner: any;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' }, // rear camera
          {
            fps: 10,
            qrbox: { width: 250, height: 180 },
            aspectRatio: 1.5,
          },
          (decodedText: string) => {
            // Barcode detected — pass up and close
            onScan(decodedText);
            onClose();
          },
          () => {} // ignore per-frame errors
        );
        setStarted(true);
      } catch (err: any) {
        setError(err?.message ?? 'Could not access camera. Please allow camera access in your browser settings.');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && started) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-sm mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-white">
          <Camera size={20} className="text-indigo-400" />
          <span className="font-bold text-lg">Scan Barcode</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white bg-slate-800 rounded-full p-2 border border-slate-700 cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Scanner viewfinder */}
      <div className="w-full max-w-sm bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
        <div id={containerId} className="w-full" />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 w-full max-w-sm bg-rose-900/50 border border-rose-500/50 rounded-xl p-4 text-rose-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* Hint */}
      {!error && (
        <p className="mt-4 text-slate-400 text-sm text-center max-w-xs">
          Point the camera at any barcode or QR code on the product
        </p>
      )}
    </div>
  );
}
