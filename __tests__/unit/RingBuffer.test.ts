import { describe, it, expect } from 'vitest';
import { RingBuffer, LogEntry } from '@core/utils/RingBuffer';

describe('RingBuffer', () => {
  it('stores items up to capacity', () => {
    const buffer = new RingBuffer<number>(3);
    
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    
    expect(buffer.size()).toBe(3);
    expect(buffer.getAll()).toEqual([1, 2, 3]);
  });

  it('overwrites oldest items when full', () => {
    const buffer = new RingBuffer<number>(3);
    
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4); // overwrites 1
    buffer.push(5); // overwrites 2
    
    expect(buffer.size()).toBe(3);
    expect(buffer.getAll()).toEqual([3, 4, 5]);
  });

  it('returns empty array when empty', () => {
    const buffer = new RingBuffer<number>(3);
    
    expect(buffer.getAll()).toEqual([]);
    expect(buffer.isEmpty()).toBe(true);
  });

  it('getLast returns last N items', () => {
    const buffer = new RingBuffer<number>(5);
    
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4);
    buffer.push(5);
    
    expect(buffer.getLast(2)).toEqual([4, 5]);
    expect(buffer.getLast(10)).toEqual([1, 2, 3, 4, 5]); // returns all if N > size
  });

  it('clear empties the buffer', () => {
    const buffer = new RingBuffer<number>(3);
    
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.clear();
    
    expect(buffer.size()).toBe(0);
    expect(buffer.isEmpty()).toBe(true);
    expect(buffer.getAll()).toEqual([]);
  });

  it('isFull returns correct state', () => {
    const buffer = new RingBuffer<number>(2);
    
    expect(buffer.isFull()).toBe(false);
    buffer.push(1);
    expect(buffer.isFull()).toBe(false);
    buffer.push(2);
    expect(buffer.isFull()).toBe(true);
  });

  it('throws on invalid capacity', () => {
    expect(() => new RingBuffer(0)).toThrow();
    expect(() => new RingBuffer(-1)).toThrow();
  });

  it('works with complex objects', () => {
    const buffer = new RingBuffer<LogEntry>(2);
    
    const log1: LogEntry = {
      timestamp: 1000,
      level: 'INFO',
      source: 'test',
      message: 'First log'
    };
    
    const log2: LogEntry = {
      timestamp: 2000,
      level: 'ERROR',
      source: 'test',
      message: 'Second log',
      data: { code: 500 }
    };
    
    buffer.push(log1);
    buffer.push(log2);
    
    const all = buffer.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].message).toBe('First log');
    expect(all[1].data?.code).toBe(500);
  });

  it('getSince filters items correctly', () => {
    const buffer = new RingBuffer<{ timestamp: number; value: string }>(5);
    
    buffer.push({ timestamp: 100, value: 'a' });
    buffer.push({ timestamp: 200, value: 'b' });
    buffer.push({ timestamp: 300, value: 'c' });
    buffer.push({ timestamp: 400, value: 'd' });
    
    const filtered = buffer.getSince(item => item.timestamp >= 250);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].value).toBe('c');
    expect(filtered[1].value).toBe('d');
  });

  it('maintains FIFO order after wraparound', () => {
    const buffer = new RingBuffer<number>(3);
    
    // Fill and wrap multiple times
    for (let i = 1; i <= 10; i++) {
      buffer.push(i);
    }
    
    // Should have last 3 items in order
    expect(buffer.getAll()).toEqual([8, 9, 10]);
  });
});
