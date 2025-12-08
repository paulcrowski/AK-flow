/**
 * IdentityShard - Atomowy fragment tożsamości
 * 
 * Przekonania, preferencje i ograniczenia powstające
 * i ewoluujące w DreamConsolidation.
 * 
 * @module core/types/IdentityShard
 */

/** Typ sharda: przekonanie, preferencja lub ograniczenie */
export type ShardKind = 'belief' | 'preference' | 'constraint';

export interface IdentityShard {
  /** Typ sharda */
  kind: ShardKind;
  
  /** Treść sharda (np. "Cenię minimalizm i precyzję") */
  content: string;
  
  /** Siła 1-100. Core shards nie spadają poniżej 50. */
  strength: number;
  
  /** Core Anchor - chroni przed dryfem tożsamości */
  is_core: boolean;
}

/** Shard z ID z bazy danych */
export interface IdentityShardWithId extends IdentityShard {
  id: string;
  last_reinforced_at?: string;
  created_at?: string;
}

/** Minimalny próg siły dla core shardów */
export const CORE_SHARD_MIN_STRENGTH = 50;

/** Maksymalna liczba shardów wysyłanych do LLM */
export const MAX_SHARDS_IN_PAYLOAD = 10;
