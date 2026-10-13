import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'motion/react';
import { Conditions } from './Conditions';
import { DatasetContext, SnapshotContext, snapshotAt, useBuildDataset } from '../../state/derive';
import { useStore } from '../../state/store';

describe('<Conditions>', () => {
  it('shows replay readings in the chosen language', () => {
    const event = JSON.parse(readFileSync('public/archive/halloween-2003.json', 'utf8'));
    useStore.getState().setReplay(event);
    useStore.getState().setPrefs({ lang: 'tr' });
    const d = renderHook(() => useBuildDataset()).result.current;
    const s = snapshotAt(d, Date.parse('2003-10-29T12:00Z'));

    render(
      <LazyMotion features={domAnimation}>
        <DatasetContext.Provider value={d}>
          <SnapshotContext.Provider value={s}>
            <Conditions />
          </SnapshotContext.Provider>
        </DatasetContext.Provider>
      </LazyMotion>,
    );

    expect(screen.getByText('Kp indeksi')).toBeTruthy();
    expect(screen.getByText('SYM-H')).toBeTruthy();
    expect(screen.getByText('GFZ kesin', { exact: false })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Kp indeksi/ })).toBeTruthy();
  });
});
