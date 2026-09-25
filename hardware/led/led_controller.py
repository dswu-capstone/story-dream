#!/usr/bin/env python3
"""WS2812 LED 스트립 제어 클래스.

배선:
  스트립 빨강(5V)  -> 물리 2번
  스트립 흰색(GND) -> 물리 39번
  스트립 초록(DIN) -> 물리 19번 (GPIO 10) + 330Ω 직렬

사전 준비:
  sudo raspi-config nonint do_spi 0
  sudo reboot
  pip install adafruit-circuitpython-neopixel-spi --break-system-packages
"""

import time

import board
import neopixel_spi


class LedStrip:
    """num_pixels 개의 WS2812 LED를 제어한다.

    colors: (R, G, B) 튜플 하나, 또는 여러 개를 리스트로 넘기면 순서대로
            돌아가며 써서 여러 빛이 번갈아 켜지는 패턴을 만들 수 있다.
    interval: 다음 동작(한 칸 이동, 한 번 깜빡임)까지 걸리는 시간(초).
    """

    def __init__(self, num_pixels, brightness=0.10, colors=(255, 120, 0), interval=1.0):
        self.num_pixels = num_pixels
        self.interval = interval
        self.default_brightness = brightness
        # colors 가 (255, 120, 0) 처럼 튜플 하나면 리스트로 감싸고,
        # [(255,0,0), (0,255,0)] 처럼 이미 리스트면 그대로 쓴다.
        self.colors = [colors] if isinstance(colors[0], int) else list(colors)

        self.pixels = neopixel_spi.NeoPixel_SPI(
            board.SPI(),
            num_pixels,
            pixel_order=neopixel_spi.GRB,
            brightness=brightness,
            auto_write=False,
        )
        self.clear()

    def _color(self, step):
        return self.colors[step % len(self.colors)]

    def clear(self):
        self.pixels.brightness = self.default_brightness
        self.pixels.fill((0, 0, 0))
        self.pixels.show()

    def glow(self, color=(255, 200, 0), brightness=0.5):
        """전체 LED를 한 가지 색으로 균일하게 켠다.

        앱이 켜졌을 때 대기 상태를 알리는 용도. 기본값은 밝은 노란색.
        """
        self.pixels.brightness = brightness
        self.pixels.fill(color)
        self.pixels.show()

    # glow 와 같지만 이름이 더 명확한 별칭
    fill = glow

    def partial(self, count, color=(255, 200, 0), brightness=0.5, reverse=False):
        """count 개만 color 로 켜고 나머지는 끈다 (진행률 표시용).

        reverse=False : 앞(0번)에서부터
        reverse=True  : 뒤(마지막)에서부터
        """
        count = max(0, min(self.num_pixels, int(count)))
        self.pixels.brightness = brightness
        self.pixels.fill((0, 0, 0))
        idxs = range(count) if not reverse else range(self.num_pixels - count, self.num_pixels)
        for i in idxs:
            self.pixels[i] = color
        self.pixels.show()
        return count

    def sequence(self, accumulate=True, loop=True):
        """한 칸씩 순서대로 켠다.

        accumulate=True 면 켠 채로 쌓이고, False 면 한 칸만 이동한다.
        loop=True 면 끝까지 가면 처음부터 반복한다.
        """
        index = 0
        try:
            while True:
                if not accumulate:
                    self.pixels.fill((0, 0, 0))
                self.pixels[index] = self._color(index)
                self.pixels.show()

                index += 1
                if index >= self.num_pixels:
                    if not loop:
                        break
                    index = 0
                    self.clear()
                time.sleep(self.interval)
        except KeyboardInterrupt:
            pass
        finally:
            self.clear()

    def blink(self, times=None):
        """전체 LED가 한꺼번에 깜빡인다. times=None 이면 Ctrl+C 전까지 반복."""
        count = 0
        try:
            while times is None or count < times:
                color = self._color(count)
                for i in range(self.num_pixels):
                    self.pixels[i] = color
                self.pixels.show()
                time.sleep(self.interval)

                self.pixels.fill((0, 0, 0))
                self.pixels.show()
                time.sleep(self.interval)
                count += 1
        except KeyboardInterrupt:
            pass
        finally:
            self.clear()

    def set_lit(self, count):
        """앞에서부터 count 개만 켜고 나머지는 끈다 (정적 상태, 진행률 표시용)."""
        count = max(0, min(self.num_pixels, count))
        self.pixels.brightness = self.default_brightness
        self.pixels.fill((0, 0, 0))
        for i in range(count):
            self.pixels[i] = self._color(i)
        self.pixels.show()
        return count
