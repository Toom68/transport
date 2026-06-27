import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Airport } from '@/types/airport';
import type { Place, JourneyType } from '@/types/place';
import type { SaveGame, VisitedPlace, JournalEntry } from '@/types/savegame';
import { createEmptySaveStats, calculateMilesEarned } from '@/types/savegame';
import {
  evaluateNewAchievements,
  legCrossesEquator,
  legCrossesDateline,
} from '@/data/achievements';
import { getSketchKey } from '@/data/citySketchData';
import { generateJournalEntry } from '@/utils/openai';
import { greatCircleDistance } from '@/engine/navigation';

export const MAX_SAVES = 5;

export interface RecordArrivalInput {
  from: Place;
  to: Place;
  journeyType: JourneyType;
  ambientMinutes: number;
  cruiseMinutes: number;
  departedLocalHour?: number;
  distanceKm?: number; // optional override; computed via great-circle if absent
}

export interface RecordArrivalResult {
  newlyUnlocked: string[];
  journalId: string;
}

interface SavegameStore {
  saves: SaveGame[];
  activeSaveId: string | null;
  pendingAchievements: string[];

  getActiveSave: () => SaveGame | null;

  createSave: (name: string, origin: Place) => string;
  loadSave: (id: string) => void;
  deleteSave: (id: string) => void;
  renameSave: (id: string, name: string) => void;
  exitToHome: () => void;

  recordArrival: (input: RecordArrivalInput) => RecordArrivalResult | null;
  fillJournalEntry: (journalId: string) => Promise<void>;
  clearPendingAchievements: () => void;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateSaveById(
  saves: SaveGame[],
  id: string,
  updater: (s: SaveGame) => SaveGame
): SaveGame[] {
  return saves.map((s) => (s.id === id ? updater(s) : s));
}

export const useSavegameStore = create<SavegameStore>()(
  persist(
    (set, get) => ({
      saves: [],
      activeSaveId: null,
      pendingAchievements: [],

      getActiveSave: () => {
        const { saves, activeSaveId } = get();
        return saves.find((s) => s.id === activeSaveId) ?? null;
      },

      createSave: (name, origin) => {
        const id = uid();
        const now = Date.now();
        const originVisit: VisitedPlace = {
          id: origin.id,
          place: origin,
          arrivedAt: now,
          departedFrom: origin.id,
          ambientMinutesDuring: 0,
          distanceKm: 0,
          journeyType: 'fly',
        };
        const save: SaveGame = {
          id,
          name: name.trim() || `Journey from ${origin.city}`,
          createdAt: now,
          lastPlayedAt: now,
          originId: origin.id,
          currentPlace: origin,
          visitedPlaces: [originVisit],
          journalEntries: [],
          unlockedAchievements: [],
          achievementUnlockedAt: {},
          stats: createEmptySaveStats(),
        };
        set((state) => {
          // keep most-recent MAX_SAVES
          const next = [save, ...state.saves].slice(0, MAX_SAVES);
          return { saves: next, activeSaveId: id, pendingAchievements: [] };
        });
        return id;
      },

      loadSave: (id) => {
        set((state) => ({
          activeSaveId: id,
          pendingAchievements: [],
          saves: updateSaveById(state.saves, id, (s) => ({ ...s, lastPlayedAt: Date.now() })),
        }));
      },

      deleteSave: (id) => {
        set((state) => {
          const saves = state.saves.filter((s) => s.id !== id);
          const activeSaveId = state.activeSaveId === id ? null : state.activeSaveId;
          return { saves, activeSaveId };
        });
      },

      renameSave: (id, name) => {
        set((state) => ({
          saves: updateSaveById(state.saves, id, (s) => ({ ...s, name: name.trim() || s.name })),
        }));
      },

      exitToHome: () => set({ activeSaveId: null, pendingAchievements: [] }),

      recordArrival: (input) => {
        const save = get().getActiveSave();
        if (!save) return null;

        const { from, to, journeyType, ambientMinutes, cruiseMinutes, departedLocalHour } = input;
        const distanceKm =
          input.distanceKm ?? greatCircleDistance(from.lat, from.lng, to.lat, to.lng);

        const now = Date.now();
        const visit: VisitedPlace = {
          id: to.id,
          place: to,
          arrivedAt: now,
          departedFrom: from.id,
          ambientMinutesDuring: ambientMinutes,
          distanceKm,
          crossedEquator: legCrossesEquator(from.lat, to.lat),
          crossedDateline: legCrossesDateline(from.lng, to.lng),
          departedLocalHour,
          cruiseMinutes,
          journeyType,
        };

        const journalId = uid();
        const journal: JournalEntry = {
          id: journalId,
          fromPlace: from,
          toPlace: to,
          text: '',
          svgKey: getSketchKey(from.id),
          createdAt: now,
          ambientMinutesDuring: ambientMinutes,
          isGenerating: true,
        };

        // Build the next save snapshot so achievements can be evaluated against it.
        const stats = { ...save.stats };
        stats.totalLegs += 1;
        if (journeyType === 'fly') stats.totalFlights += 1;
        if (journeyType === 'drive') stats.totalDrives += 1;
        if (journeyType === 'sail') stats.totalSails += 1;
        stats.totalAmbientMinutes += ambientMinutes;
        stats.totalDistanceKm += distanceKm;
        stats.longestLegKm = Math.max(stats.longestLegKm, distanceKm);
        stats.shortestLegKm = Math.min(stats.shortestLegKm, distanceKm);
        stats.maxCruiseMinutesInLeg = Math.max(stats.maxCruiseMinutesInLeg, cruiseMinutes);
        stats.miles += calculateMilesEarned(distanceKm, ambientMinutes);

        const nextSave: SaveGame = {
          ...save,
          currentPlace: to,
          lastPlayedAt: now,
          visitedPlaces: [...save.visitedPlaces, visit],
          journalEntries: [journal, ...save.journalEntries],
          stats,
        };

        const newlyUnlocked = evaluateNewAchievements(nextSave);
        if (newlyUnlocked.length > 0) {
          nextSave.unlockedAchievements = [...nextSave.unlockedAchievements, ...newlyUnlocked];
          for (const aid of newlyUnlocked) {
            nextSave.achievementUnlockedAt[aid] = now;
          }
        }

        set((state) => ({
          saves: updateSaveById(state.saves, save.id, () => nextSave),
          pendingAchievements: [...state.pendingAchievements, ...newlyUnlocked],
        }));

        return { newlyUnlocked, journalId };
      },

      fillJournalEntry: async (journalId) => {
        const save = get().getActiveSave();
        if (!save) return;
        const entry = save.journalEntries.find((j) => j.id === journalId);
        if (!entry) return;

        const result = await generateJournalEntry(
          entry.fromPlace,
          entry.toPlace,
          entry.ambientMinutesDuring
        );

        set((state) => ({
          saves: updateSaveById(state.saves, save.id, (s) => ({
            ...s,
            journalEntries: s.journalEntries.map((j) =>
              j.id === journalId
                ? { ...j, text: result.text, isGenerating: false, isFallback: result.isFallback }
                : j
            ),
          })),
        }));
      },

      clearPendingAchievements: () => set({ pendingAchievements: [] }),
    }),
    {
      name: 'transportfocus-saves',
      version: 1,
    }
  )
);
