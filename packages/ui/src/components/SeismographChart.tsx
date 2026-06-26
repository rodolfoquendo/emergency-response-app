import { useEffect, useRef } from 'react';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { View } from 'react-native';
import type { SeismicReading } from '@quakelink/seismograph';

type Props = {
  readings: SeismicReading[];
  width?: number;
  height?: number;
  lineColor?: string;
};

export function SeismographChart({ readings, width = 320, height = 200, lineColor = '#ff4444' }: Props) {
  if (readings.length < 2) {
    return <View style={{ width, height }} />;
  }

  const path = Skia.Path.Make();
  const maxVal = Math.max(...readings.map((r) => Math.abs(r.z)), 1);
  const midY = height / 2;

  readings.forEach((reading, i) => {
    const x = (i / (readings.length - 1)) * width;
    const y = midY - (reading.z / maxVal) * midY * 0.9;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });

  const paint = Skia.Paint();
  paint.setColor(Skia.Color(lineColor));
  paint.setStrokeWidth(2);
  paint.setStyle(1); // stroke

  return (
    <Canvas style={{ width, height }}>
      <Path path={path} paint={paint} />
    </Canvas>
  );
}
