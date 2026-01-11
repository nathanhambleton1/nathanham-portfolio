import React, { useEffect, useState, useRef } from "react";
import useLockBodyScroll from "../hooks/use-lock-body-scroll";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "./ui/button";
import { getPlayerStatistics } from "../lib/playerStatsTracking";

type Player = { id: string; name: string; balance?: number };

type PlayerStats = {
  times_passed_go: number;
  times_went_to_jail: number;
  times_landed_free_parking: number;
  money_received_from_go: number;
  money_received_from_free_parking: number;
  money_received_from_players: number;
  money_received_from_bank: number;
  total_money_received: number;
  money_paid_to_bank: number;
  money_paid_to_players: number;
  money_paid_for_jail: number;
  total_money_spent: number;
  total_tax_paid: number;
  total_rent_paid: number;
  total_rent_received: number;
  times_others_landed_on_properties: number;
  current_luck_score: number;
};

// Simple in-memory cache to avoid refetching while the app is running
const statsCache = new Map<string, PlayerStats | null>();

export default function BankruptStatus({
  open,
  onOpenChange,
  currentPlayer,
  gameId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlayer: Player | null;
  gameId?: string | null;
}) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);

  useLockBodyScroll(!!open);

  const prevOpenRef = useRef<boolean>(false);

  useEffect(() => {
    const prev = prevOpenRef.current;
    // Only fetch when dialog transitions from closed -> open
    if (!prev && open) {
      const playerId = currentPlayer?.id;
      if (!playerId || !gameId) {
        setStats(null);
        prevOpenRef.current = open;
        return;
      }

      const cacheKey = `${gameId}_${playerId}`;
      if (statsCache.has(cacheKey)) {
        setStats(statsCache.get(cacheKey) ?? null);
        prevOpenRef.current = open;
        return;
      }

      setLoading(true);
      getPlayerStatistics(gameId)
        .then((allStats: any[]) => {
          const s = allStats.find((st) => st.player_id === playerId);
          if (s) {
            const mapped: PlayerStats = {
              times_passed_go: s.times_passed_go || 0,
              times_went_to_jail: s.times_went_to_jail || 0,
              times_landed_free_parking: s.times_landed_free_parking || 0,
              money_received_from_go: s.money_received_from_go || 0,
              money_received_from_free_parking: s.money_received_from_free_parking || 0,
              money_received_from_players: s.money_received_from_players || 0,
              money_received_from_bank: s.money_received_from_bank || 0,
              total_money_received: s.total_money_received || 0,
              money_paid_to_bank: s.money_paid_to_bank || 0,
              money_paid_to_players: s.money_paid_to_players || 0,
              money_paid_for_jail: s.money_paid_for_jail || 0,
              total_money_spent: s.total_money_spent || 0,
              total_tax_paid: s.total_tax_paid || 0,
              total_rent_paid: s.total_rent_paid || 0,
              total_rent_received: s.total_rent_received || 0,
              times_others_landed_on_properties: s.times_others_landed_on_properties || 0,
              current_luck_score: s.current_luck_score || 0,
            };
            statsCache.set(cacheKey, mapped);
            setStats(mapped);
          } else {
            statsCache.set(cacheKey, null);
            setStats(null);
          }
        })
        .catch(() => {
          statsCache.set(cacheKey, null);
          setStats(null);
        })
        .finally(() => setLoading(false));
    }
    prevOpenRef.current = open;
  }, [open, currentPlayer?.id, gameId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 border bg-background p-6 shadow-lg sm:rounded-lg md:w-full">
          <DialogHeader>
            <DialogTitle>Game Stats Recap</DialogTitle>
            <DialogDescription>
                Here's a summary of your game stats before declaring bankruptcy.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 p-3 bg-background rounded border">
            <div className="text-sm font-semibold mb-2">Stats Recap</div>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading stats...</div>
            ) : stats ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Movement & Events</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Times Passed Go</div>
                      <div className="font-medium">{stats.times_passed_go}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Times Went To Jail</div>
                      <div className="font-medium">{stats.times_went_to_jail}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Free Parking Landings</div>
                      <div className="font-medium">{stats.times_landed_free_parking}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-green-600 mb-1">Money Received</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">From Passing Go</div>
                      <div className="font-medium text-green-600">${stats.money_received_from_go.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">From Free Parking</div>
                      <div className="font-medium text-green-600">${stats.money_received_from_free_parking.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">From Players</div>
                      <div className="font-medium text-green-600">${stats.money_received_from_players.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">From Bank</div>
                      <div className="font-medium text-green-600">${stats.money_received_from_bank.toLocaleString()}</div>
                    </div>
                    <div className="col-span-2 pt-1 border-t">
                      <div className="text-muted-foreground">Total Money Received</div>
                      <div className="font-bold text-green-600">${stats.total_money_received.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-red-600 mb-1">Money Spent</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Paid to Bank (Tax/Fees)</div>
                      <div className="font-medium text-red-600">${stats.money_paid_to_bank.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Paid to Players</div>
                      <div className="font-medium text-red-600">${stats.money_paid_to_players.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Jail Payments</div>
                      <div className="font-medium text-red-600">${stats.money_paid_for_jail.toLocaleString()}</div>
                    </div>
                    <div className="col-span-2 pt-1 border-t">
                      <div className="text-muted-foreground">Total Money Spent</div>
                      <div className="font-bold text-red-600">${stats.total_money_spent.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-muted rounded">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Net Money Flow</div>
                      <div className={`font-bold ${(stats.total_money_received - stats.total_money_spent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(stats.total_money_received - stats.total_money_spent) >= 0 ? '+' : ''}${(stats.total_money_received - stats.total_money_spent).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Luck Score</div>
                      <div className={`font-medium ${stats.current_luck_score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stats.current_luck_score >= 0 ? '+' : ''}{stats.current_luck_score.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No stats available for this game.</div>
            )}
          </div>

          <DialogFooter className="mt-6 flex gap-3 w-full justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
