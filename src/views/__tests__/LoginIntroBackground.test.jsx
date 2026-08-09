// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import LoginIntroBackground from '../LoginIntroBackground';

afterEach(() => cleanup());

describe('LoginIntroBackground', () => {
  it('renders the intro video muted/inline/autoplaying and NOT looping, so it freezes on the last frame once it ends', () => {
    render(<LoginIntroBackground />);
    const video = screen.getByTestId('login-intro-video');
    expect(video.src).toContain('/jl-engineering-intro.mp4');
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(false);
    expect(video.getAttribute('playsinline')).not.toBeNull();
  });
});
