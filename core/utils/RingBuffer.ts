/**
 * RingBuffer - Limitowany bufor cykliczny dla logów
 * 
 * Przechowuje ostatnie N elementów bez memory leak.
 * Gdy bufor jest pełny, najstarsze elementy są nadpisywane.
 */

export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('RingBuffer capacity must be positive');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Dodaje element do bufora
   * Jeśli bufor jest pełny, nadpisuje najstarszy element
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    
    if (this.count < this.capacity) {
      this.count++;
    } else {
      // Buffer is full, move head forward (overwrite oldest)
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Pobiera wszystkie elementy w kolejności chronologicznej
   */
  getAll(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head + i) % this.capacity;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Pobiera ostatnie N elementów
   */
  getLast(n: number): T[] {
    const all = this.getAll();
    return all.slice(-n);
  }

  /**
   * Pobiera elementy od danego timestampu
   */
  getSince(predicate: (item: T) => boolean): T[] {
    return this.getAll().filter(predicate);
  }

  /**
   * Czyści bufor
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  /**
   * Zwraca aktualną liczbę elementów
   */
  size(): number {
    return this.count;
  }

  /**
   * Zwraca pojemność bufora
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Czy bufor jest pełny
   */
  isFull(): boolean {
    return this.count === this.capacity;
  }

  /**
   * Czy bufor jest pusty
   */
  isEmpty(): boolean {
    return this.count === 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOG ENTRY TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface LogEntry {
  timestamp: number;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  source: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface StateSnapshot {
  timestamp: number;
  limbicState: {
    fear: number;
    curiosity: number;
    frustration: number;
    satisfaction: number;
  };
  chemState: {
    dopamine: number;
    serotonin: number;
    norepinephrine: number;
  };
  somaState: {
    energy: number;
    cognitiveLoad: number;
    isSleeping: boolean;
  };
  activeGoal?: string;
  conversationLength: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL LOG BUFFER (Singleton)
// ═══════════════════════════════════════════════════════════════════════════

const LOG_BUFFER_SIZE = 500;
const STATE_BUFFER_SIZE = 100;

export const logBuffer = new RingBuffer<LogEntry>(LOG_BUFFER_SIZE);
export const stateBuffer = new RingBuffer<StateSnapshot>(STATE_BUFFER_SIZE);

/**
 * Dodaje log do globalnego bufora
 */
export function addLog(
  level: LogEntry['level'],
  source: string,
  message: string,
  data?: Record<string, unknown>
): void {
  logBuffer.push({
    timestamp: Date.now(),
    level,
    source,
    message,
    data
  });
}

/**
 * Dodaje snapshot stanu do bufora
 */
export function addStateSnapshot(snapshot: Omit<StateSnapshot, 'timestamp'>): void {
  stateBuffer.push({
    ...snapshot,
    timestamp: Date.now()
  });
}

/**
 * Eksportuje logi z bufora
 */
export function exportLogs(lastN?: number): LogEntry[] {
  if (lastN) {
    return logBuffer.getLast(lastN);
  }
  return logBuffer.getAll();
}

/**
 * Eksportuje snapshoty stanów z bufora
 */
export function exportStateSnapshots(lastN?: number): StateSnapshot[] {
  if (lastN) {
    return stateBuffer.getLast(lastN);
  }
  return stateBuffer.getAll();
}
