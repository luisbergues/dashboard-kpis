// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import IntroSplash from '../IntroSplash';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('IntroSplash', () => {
  it('renders the intro video ready to autoplay muted and inline, without looping', () => {
    render(<IntroSplash onDone={() => {}} />);
    const video = screen.getByTestId('intro-splash-video');
    expect(video.src).toContain('/jl-engineering-intro.mp4');
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(false);
    expect(video.getAttribute('playsinline')).not.toBeNull();
  });

  it('does not call onDone just from mounting', () => {
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('starts the fade-out on click, then calls onDone once the fade transition ends', () => {
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    const overlay = screen.getByTestId('intro-splash-overlay');

    fireEvent.click(overlay);
    expect(onDone).not.toHaveBeenCalled(); // fade still in progress
    expect(overlay.style.opacity).toBe('0');

    fireEvent.transitionEnd(overlay);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('starts the fade-out on Escape', () => {
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    const overlay = screen.getByTestId('intro-splash-overlay');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(overlay.style.opacity).toBe('0');

    fireEvent.transitionEnd(overlay);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('starts the fade-out when the video finishes playing on its own', () => {
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    const video = screen.getByTestId('intro-splash-video');
    const overlay = screen.getByTestId('intro-splash-overlay');

    fireEvent.ended(video);
    expect(overlay.style.opacity).toBe('0');

    fireEvent.transitionEnd(overlay);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('starts the fade-out on its own after 4s, even without any interaction', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    const overlay = screen.getByTestId('intro-splash-overlay');

    expect(overlay.style.opacity).toBe('1');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(overlay.style.opacity).toBe('0');

    fireEvent.transitionEnd(overlay);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
