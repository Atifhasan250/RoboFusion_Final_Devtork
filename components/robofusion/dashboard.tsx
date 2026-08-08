"use client";

/* eslint-disable @next/next/no-img-element -- ESP32 camera endpoints can be MJPEG streams. */
import type { ReactNode, RefObject } from "react";
import { useMemo, useRef, useState } from "react";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  Cpu,
  Database,
  Droplet,
  Fingerprint,
  HardDrive,
  Radar,
  Search,
  ShieldCheck,
  Sync,
  Tag,
  Thermometer,
  Trash,
  Wifi,
  WifiOff,
} from "@/components/robofusion/icons";
import { useRoboFusionData } from "@/hooks/use-robofusion-data";
import {
  acknowledgeAlert,
  deviceCameraUrl,
  searchHistory,
} from "@/lib/api-client";
import type { TelemetryEvent } from "@/types/telemetry";

type Tone = "brand" | "danger" | "warn" | "lime" | "neutral";
type Marker = "RED" | "BLUE" | "YELLOW" | "GREEN" | "UNKNOWN";
type Presence = "OCCUPIED" | "EMPTY" | "UNKNOWN";
type Overall = "SAFE" | "WARNING" | "DANGER";
type IrStatus = "CLEAR" | "OBSTACLE" | "ERROR";
type SyncState = "SYNCED" | "CATCHING_UP" | "PENDING";
type Connection = "LIVE" | "CATCHING_UP" | "OFFLINE";
type NavItem = "Dashboard" | "Live Monitor" | "Logs" | "Alerts";

type DemoRecord = {
  id: number;
  time: string;
  temp: number | null;
  humidity: number | null;
  ir: IrStatus;
  presence: Presence;
  marker: Marker;
  overall: Overall;
  sync: SyncState;
};

type AlertEntry = {
  id: string;
  triggeredAt: string;
  condition: string;
  status: "PENDING" | "ACKNOWLEDGED";
  acknowledgedAt: string | null;
  method: "Dashboard" | "Physical push-button" | null;
};

const CAMERA_IMG =
  "https://images.unsplash.com/photo-1748002645678-7f9c04263315?w=1280&h=720&fit=crop&auto=format";
const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID ?? "mock-device";
const NAV: NavItem[] = ["Dashboard", "Live Monitor", "Logs", "Alerts"];
const markers: Marker[] = ["BLUE", "GREEN", "YELLOW", "RED", "UNKNOWN"];

const initialLog: AlertEntry[] = [
  {
    id: "ALRT-2048",
    triggeredAt: "2026-08-08 14:18:52",
    condition: "IR obstacle + occupancy held ≥ 2s",
    status: "ACKNOWLEDGED",
    acknowledgedAt: "2026-08-08 14:19:07",
    method: "Dashboard",
  },
  {
    id: "ALRT-2041",
    triggeredAt: "2026-08-08 13:55:10",
    condition: "Temperature 41.2°C exceeded threshold",
    status: "ACKNOWLEDGED",
    acknowledgedAt: "2026-08-08 13:55:24",
    method: "Physical push-button",
  },
  {
    id: "ALRT-2039",
    triggeredAt: "2026-08-08 13:41:33",
    condition: "Occupancy during locked cycle",
    status: "ACKNOWLEDGED",
    acknowledgedAt: "2026-08-08 13:41:49",
    method: "Dashboard",
  },
];

function seeded(index: number) {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function buildRecords(): DemoRecord[] {
  const rows: DemoRecord[] = [];
  const baseSeconds = 14 * 3600 + 32 * 60 + 8;
  for (let index = 0; index < 256; index += 1) {
    const time = baseSeconds - index * 2;
    const random = seeded(index);
    const random2 = seeded(index + 500);
    const sensorError = index === 6 || index === 41;
    rows.push({
      id: 4096 - index,
      time: `${pad(Math.floor(time / 3600))}:${pad(Math.floor((time % 3600) / 60))}:${pad(time % 60)}`,
      temp: sensorError ? null : Math.round((26.8 + random * 2.6) * 10) / 10,
      humidity: sensorError ? null : Math.round(60 + random2 * 9),
      ir:
        index === 12
          ? "OBSTACLE"
          : sensorError
            ? "ERROR"
            : random > 0.82
              ? "OBSTACLE"
              : "CLEAR",
      presence: random2 > 0.35 ? "OCCUPIED" : "EMPTY",
      marker: index === 4 ? "UNKNOWN" : markers[Math.floor(random * markers.length)],
      overall: index < 3 || random > 0.9 ? "WARNING" : "SAFE",
      sync:
        index < 5
          ? "SYNCED"
          : index < 9
            ? "CATCHING_UP"
            : random2 > 0.86
              ? "PENDING"
              : "SYNCED",
    });
  }
  return rows;
}

function toDemoRecord(event: TelemetryEvent): DemoRecord {
  return {
    id: event.seq,
    time: event.occurredAt.slice(11, 19),
    temp: event.climate.connected ? (event.climate.temperatureC ?? null) : null,
    humidity: event.climate.connected ? (event.climate.humidityPct ?? null) : null,
    ir: !event.ir.connected
      ? "ERROR"
      : event.ir.occupiedRaw
        ? "OBSTACLE"
        : "CLEAR",
    presence: event.presence,
    marker: event.marker,
    overall: event.overallStatus,
    sync:
      event.connectionState === "LIVE"
        ? "SYNCED"
        : event.connectionState === "CATCHING_UP"
          ? "CATCHING_UP"
          : "PENDING",
  };
}

function toDateTimeInput(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-line bg-card shadow-[0_1px_2px_rgba(38,41,39,0.04),0_8px_24px_-16px_rgba(38,41,39,0.12)] ${className}`}>{children}</section>;
}

function CardHead({ title, icon, aside }: { title: string; icon?: ReactNode; aside?: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 px-6 pt-5"><h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink">{icon && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-soft text-brand">{icon}</span>}{title}</h2>{aside}</div>;
}

function Pill({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  const tones: Record<Tone, string> = {
    brand: "text-brand-strong bg-brand-soft",
    danger: "text-danger bg-danger-soft",
    warn: "text-warn bg-warn/10",
    lime: "text-ink bg-lime/25",
    neutral: "text-ink-2 bg-soft",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}>{children}</span>;
}

function IconCircle({ children, tone = "brand" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    brand: "bg-brand-soft text-brand",
    lime: "bg-lime/25 text-ink",
    danger: "bg-danger-soft text-danger",
    warn: "bg-warn/12 text-warn",
    neutral: "bg-soft text-ink-2",
  };
  return <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>{children}</span>;
}

function Heartbeat({ alive }: { alive: boolean }) {
  return <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2"><span className={`h-2 w-2 rounded-full ${alive ? "bg-brand animate-live-dot" : "bg-mute"}`} />{alive ? "Live" : "Offline"}</span>;
}

function PresenceBadge({ presence }: { presence: Presence }) {
  if (presence === "OCCUPIED") return <Pill tone="brand"><span className="h-1.5 w-1.5 rounded-full bg-brand" />Occupied</Pill>;
  if (presence === "EMPTY") return <Pill><span className="h-1.5 w-1.5 rounded-full bg-mute" />Empty</Pill>;
  return <Pill tone="warn"><span className="h-1.5 w-1.5 rounded-full bg-warn" />Unknown</Pill>;
}

const swatch: Record<Marker, string> = {
  RED: "bg-danger",
  BLUE: "bg-[#3b82f6]",
  YELLOW: "bg-warn",
  GREEN: "bg-brand",
  UNKNOWN: "bg-mute",
};

function MarkerBadge({ marker }: { marker: Marker }) {
  return <Pill><span className={`h-2 w-2 rounded-full ${swatch[marker]}`} />{marker.charAt(0) + marker.slice(1).toLowerCase()}</Pill>;
}

function StatusDot({ tone, label }: { tone: "brand" | "danger" | "warn"; label: string }) {
  const dots = { brand: "bg-brand", danger: "bg-danger", warn: "bg-warn" };
  return <span className="inline-flex items-center gap-2 text-sm text-ink"><span className={`h-2 w-2 shrink-0 rounded-full ${dots[tone]}`} />{label}</span>;
}

function IrCell({ ir }: { ir: IrStatus }) {
  if (ir === "CLEAR") return <StatusDot tone="brand" label="Clear" />;
  if (ir === "OBSTACLE") return <StatusDot tone="danger" label="Obstacle" />;
  return <StatusDot tone="warn" label="Sensor error" />;
}

function OverallPill({ status }: { status: Overall }) {
  const config: Record<Overall, { tone: Tone; label: string }> = {
    SAFE: { tone: "brand", label: "Safe" },
    WARNING: { tone: "warn", label: "Warning" },
    DANGER: { tone: "danger", label: "Danger" },
  };
  return <Pill tone={config[status].tone}>{config[status].label}</Pill>;
}

function SyncBadge({ sync }: { sync: SyncState }) {
  if (sync === "SYNCED") return <Pill tone="brand">Synced</Pill>;
  if (sync === "CATCHING_UP") return <Pill tone="lime">Catching up</Pill>;
  return <Pill>Pending</Pill>;
}

function SensorValue({ value, suffix }: { value: number | null; suffix: string }) {
  return value === null ? <span className="text-danger">— err</span> : <span className="text-ink">{value}<span className="text-ink-2">{suffix}</span></span>;
}

function RecordsTable({ rows, sortDesc, onToggleSort, maxHeight = "440px", highlightNewest = false }: { rows: DemoRecord[]; sortDesc: boolean; onToggleSort: () => void; maxHeight?: string; highlightNewest?: boolean }) {
  return <div className="overflow-hidden rounded-2xl border border-line"><div className="overflow-auto" style={{ maxHeight }}><table className="w-full min-w-[820px] border-collapse text-sm"><thead className="sticky top-0 z-10"><tr className="bg-soft text-left text-[12px] font-medium text-ink-2"><th className="px-5 py-3"><button onClick={onToggleSort} className="inline-flex items-center gap-1 transition-colors hover:text-ink">Timestamp{sortDesc ? <ArrowDown width={12} height={12} /> : <ArrowUp width={12} height={12} />}</button></th><th className="px-5 py-3">Temperature</th><th className="px-5 py-3">Humidity</th><th className="px-5 py-3">IR Status</th><th className="px-5 py-3">Presence</th><th className="px-5 py-3">Color</th><th className="px-5 py-3">Overall</th><th className="px-5 py-3">Sync</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} className={`border-t border-line transition-colors hover:bg-soft/70 ${highlightNewest && index === 0 ? "bg-brand-soft/50" : ""}`}><td className="px-5 py-3.5 tnum text-ink-2">{row.time}</td><td className="px-5 py-3.5 tnum"><SensorValue value={row.temp} suffix=" °C" /></td><td className="px-5 py-3.5 tnum"><SensorValue value={row.humidity} suffix=" %" /></td><td className="px-5 py-3.5"><IrCell ir={row.ir} /></td><td className="px-5 py-3.5"><PresenceBadge presence={row.presence} /></td><td className="px-5 py-3.5"><MarkerBadge marker={row.marker} /></td><td className="px-5 py-3.5"><OverallPill status={row.overall} /></td><td className="px-5 py-3.5"><SyncBadge sync={row.sync} /></td></tr>)}</tbody></table></div></div>;
}

function Metric({ icon, label, value, unit, sub }: { icon: ReactNode; label: string; value: string; unit: string; sub: string }) {
  return <Card className="p-5"><div className="flex items-start justify-between"><IconCircle>{icon}</IconCircle></div><div className="mt-4 text-[13px] font-medium text-ink-2">{label}</div><div className="mt-0.5 flex items-baseline gap-1"><span className="text-[40px] font-semibold leading-none tnum text-ink">{value}</span><span className="text-[18px] text-ink-2">{unit}</span></div><p className="mt-2 text-[12px] text-ink-2">{sub}</p></Card>;
}

function Ops({ icon, title, value, pct, tone = "brand", note }: { icon: ReactNode; title: string; value: string; pct?: number; tone?: "brand" | "warn"; note: string }) {
  return <Card className="flex flex-col gap-2 p-5"><div className="flex items-center gap-2 text-[13px] font-medium text-ink-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-soft text-ink-2">{icon}</span>{title}</div><div className="text-[24px] font-semibold tnum text-ink">{value}</div>{pct !== undefined ? <div className="h-2 w-full overflow-hidden rounded-full bg-soft"><div className={`h-full rounded-full ${tone === "warn" ? "bg-warn" : "bg-brand"}`} style={{ width: `${pct}%` }} /></div> : <div className="h-2" />}<p className="text-[12px] text-ink-2">{note}</p></Card>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5"><span className="text-[12px] font-medium text-ink-2">{label}</span>{children}</label>;
}

export function RoboFusionDashboard() {
  const {
    state: deviceState,
    records: deviceRecords,
    error: deviceError,
    isLoading,
    refresh,
  } = useRoboFusionData(DEVICE_ID);
  const [demoConnection, setDemoConnection] = useState<Connection>("LIVE");
  const [nav, setNav] = useState<NavItem>("Dashboard");
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [log, setLog] = useState<AlertEntry[]>(initialLog);
  const sequence = useRef(2049);
  const ackSequence = useRef(20);
  const [sortDesc, setSortDesc] = useState(true);
  const [cameraDegraded, setCameraDegraded] = useState(false);
  const [cameraRetry, setCameraRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [results, setResults] = useState<DemoRecord[] | null>(null);
  const [searchedRange, setSearchedRange] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const topRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const navRefs: Record<NavItem, RefObject<HTMLDivElement | null>> = { Dashboard: topRef, "Live Monitor": cameraRef, Logs: logsRef, Alerts: alertsRef };

  const demoRecords = useMemo(() => buildRecords(), []);
  const records = useMemo(
    () =>
      deviceState
        ? deviceRecords
            .map(toDemoRecord)
            .sort((left, right) => right.id - left.id)
        : demoRecords,
    [demoRecords, deviceRecords, deviceState],
  );
  const sorted = useMemo(() => (sortDesc ? records : [...records].reverse()), [records, sortDesc]);
  const logRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sorted;
    return sorted.filter((row) => row.time.includes(normalized) || row.marker.toLowerCase().includes(normalized) || row.ir.toLowerCase().includes(normalized) || row.presence.toLowerCase().includes(normalized));
  }, [query, sorted]);

  function goTo(item: NavItem) {
    setNav(item);
    navRefs[item].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cycleConnection() {
    if (deviceState) {
      void refresh();
      return;
    }
    setDemoConnection((current) => current === "LIVE" ? "CATCHING_UP" : current === "CATCHING_UP" ? "OFFLINE" : "LIVE");
  }

  function triggerDanger() {
    const id = `ALRT-${sequence.current++}`;
    setAlerts((current) => [{ id, triggeredAt: `2026-08-08 14:32:${String(10 + current.length * 3).padStart(2, "0")}`, condition: current.length % 2 === 0 ? "Obstacle detected while presence is active" : "Temperature spike 42.6°C sustained ≥ 2s", status: "PENDING", acknowledgedAt: null, method: null }, ...current]);
  }

  function acknowledgeDemo(id: string, method: "Dashboard" | "Physical push-button") {
    setAlerts((current) => {
      const target = current.find((item) => item.id === id);
      if (!target) return current;
      const acknowledgedAt = `2026-08-08 14:32:${String(ackSequence.current++).padStart(2, "0")}`;
      setLog((entries) => entries.some((item) => item.id === id) ? entries : [{ ...target, status: "ACKNOWLEDGED", acknowledgedAt, method }, ...entries]);
      return current.filter((item) => item.id !== id);
    });
  }

  async function acknowledgeCurrent(id: string) {
    if (id !== deviceState?.alert?.alertId) {
      acknowledgeDemo(id, "Dashboard");
      return;
    }
    setAcknowledgingId(id);
    try {
      const result = await acknowledgeAlert(id, crypto.randomUUID());
      setLog((entries) =>
        entries.some((item) => item.id === id)
          ? entries
          : [
              {
                id,
                triggeredAt: deviceState.occurredAt.replace("T", " ").slice(0, 19),
                condition: "Device-authoritative danger condition",
                status: "ACKNOWLEDGED",
                acknowledgedAt: result.acknowledgedAt.replace("T", " ").slice(0, 19),
                method:
                  result.acknowledgedBy === "physical"
                    ? "Physical push-button"
                    : "Dashboard",
              },
              ...entries,
            ],
      );
      await refresh();
    } finally {
      setAcknowledgingId(null);
    }
  }

  async function runSearch() {
    const from = start ? start.slice(11) : "00:00";
    const to = end ? end.slice(11) : "23:59";
    if (!start || !end) {
      setResults(records.filter((row) => row.time.slice(0, 5) >= from && row.time.slice(0, 5) <= to));
      setSearchedRange(`${from} → ${to}`);
      setHistoryError(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await searchHistory(
        DEVICE_ID,
        new Date(start).toISOString(),
        new Date(end).toISOString(),
      );
      setResults(response.items.map(toDemoRecord).sort((left, right) => right.id - left.id));
      setSearchedRange(`${from} → ${to}`);
    } catch (error) {
      setResults([]);
      setSearchedRange(`${from} → ${to}`);
      setHistoryError(error instanceof Error ? error.message : "History search failed");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function lastTwoMinutes() {
    const endDate = new Date(deviceState?.occurredAt ?? Date.now());
    const startDate = new Date(endDate.getTime() - 120_000);
    setStart(toDateTimeInput(startDate.toISOString()));
    setEnd(toDateTimeInput(endDate.toISOString()));
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await searchHistory(
        DEVICE_ID,
        startDate.toISOString(),
        endDate.toISOString(),
      );
      setResults(response.items.map(toDemoRecord).sort((left, right) => right.id - left.id));
      setSearchedRange(`${startDate.toISOString().slice(11, 16)} → ${endDate.toISOString().slice(11, 16)} · Last 2 minutes`);
    } catch (error) {
      setResults([]);
      setSearchedRange("Last 2 minutes");
      setHistoryError(error instanceof Error ? error.message : "History search failed");
    } finally {
      setHistoryLoading(false);
    }
  }

  function clearSearch() {
    setStart("");
    setEnd("");
    setResults(null);
    setSearchedRange(null);
    setHistoryError(null);
  }

  const connection: Connection = deviceError
    ? "OFFLINE"
    : (deviceState?.connectionState ?? demoConnection);
  const currentPresence = deviceState?.presence ?? "OCCUPIED";
  const currentMarker = deviceState?.marker ?? "BLUE";
  const currentOverall = deviceState?.overallStatus ?? "WARNING";
  const currentTrend = deviceState?.trend ?? "RISING";
  const temperature =
    deviceState?.climate.connected && deviceState.climate.temperatureC !== undefined
      ? deviceState.climate.temperatureC.toFixed(1)
      : deviceState
        ? "—"
        : "28.4";
  const humidity =
    deviceState?.climate.connected && deviceState.climate.humidityPct !== undefined
      ? Math.round(deviceState.climate.humidityPct).toString()
      : deviceState
        ? "—"
        : "65";
  const irConnected = deviceState?.ir.connected ?? true;
  const obstacle = deviceState?.ir.occupiedRaw ?? false;
  const deviceAlert: AlertEntry | null =
    deviceState?.alert?.state === "OPEN"
      ? {
          id: deviceState.alert.alertId,
          triggeredAt: deviceState.occurredAt.replace("T", " ").slice(0, 19),
          condition: "Device-authoritative danger condition",
          status: "PENDING",
          acknowledgedAt: null,
          method: null,
        }
      : null;
  const visibleAlerts = deviceAlert
    ? [deviceAlert, ...alerts.filter((alert) => alert.id !== deviceAlert.id)]
    : alerts;
  const visibleLog = deviceState
    ? log.filter(
        (entry) => !initialLog.some((demoEntry) => demoEntry.id === entry.id),
      )
    : log;
  const cameraWarning =
    cameraDegraded || (Boolean(deviceState) && !deviceCameraUrl);

  const connectionConfig: Record<Connection, { label: string; tone: Tone }> = {
    LIVE: { label: "Live", tone: "brand" },
    OFFLINE: { label: "Offline", tone: "neutral" },
    CATCHING_UP: { label: "Catching Up", tone: "lime" },
  };
  const connectionIcon = connection === "LIVE" ? <Wifi width={13} height={13} /> : connection === "OFFLINE" ? <WifiOff width={13} height={13} /> : <Sync width={13} height={13} className="animate-spin" />;

  return <div className="min-h-screen bg-page text-ink">
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md"><div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-6 lg:px-8"><div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white"><Camera width={18} height={18} /></div><span className="text-[16px] font-semibold tracking-tight">RoboFusion Monitor</span></div><nav aria-label="Dashboard sections" className="hidden items-center gap-1 rounded-full border border-line bg-card p-1 md:flex">{NAV.map((item) => <button key={item} onClick={() => goTo(item)} className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${nav === item ? "bg-ink text-white" : "text-ink-2 hover:text-ink"}`}>{item}</button>)}</nav><div className="flex items-center gap-2"><button onClick={cycleConnection} title={deviceState ? "Refresh device state" : "Cycle connection (demo)"} className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5"><Pill tone={connectionConfig[connection].tone}>{connectionIcon}{connectionConfig[connection].label}</Pill></button><button aria-label="Device details" className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink-2 transition-colors hover:text-ink"><Cpu width={17} height={17} /></button><button aria-label="Alerts" onClick={() => goTo("Alerts")} className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink-2 transition-colors hover:text-ink"><AlertTriangle width={16} height={16} />{visibleAlerts.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />}</button></div></div></header>

    <main className="mx-auto max-w-[1440px] space-y-5 px-6 py-7 lg:px-8">
      <div ref={topRef} className="flex scroll-mt-[90px] flex-wrap items-end justify-between gap-3"><div><h1 className="text-[30px] font-semibold tracking-tight text-ink">Welcome to RoboFusion Monitor</h1><p className="mt-1 text-[14px] text-ink-2">Real-time safety monitoring with a separate ESP32-hosted fallback dashboard.</p></div><div className="flex items-center gap-4 text-[13px] text-ink-2"><Heartbeat alive={connection !== "OFFLINE"} /><span className="tnum">{isLoading ? "Connecting…" : deviceState ? `Last update ${deviceState.occurredAt.slice(11, 19)}` : "Demo data · device unavailable"}</span></div></div>

      <section aria-live="assertive">{visibleAlerts.length === 0 ? <Card className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"><span className="flex items-center gap-2.5 text-sm"><IconCircle><ShieldCheck width={18} height={18} /></IconCircle><span><span className="font-medium text-ink">No active alerts</span><span className="ml-2 text-ink-2">{deviceError ? "Device is unreachable; showing the last available demo state." : "All danger conditions clear."}</span></span></span>{!deviceState && <button onClick={triggerDanger} className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-danger/40 hover:text-danger">Simulate alert (demo)</button>}</Card> : <div className="space-y-3">{visibleAlerts.map((alert) => <div key={alert.id} className="flex flex-col gap-4 rounded-[20px] border border-danger/25 bg-danger-soft px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><IconCircle tone="danger"><AlertTriangle width={19} height={19} /></IconCircle><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[15px] font-semibold text-ink">Safety Alert</h3><span className="tnum text-xs text-danger">{alert.id}</span><Pill tone="danger">Pending</Pill></div><p className="mt-0.5 text-sm text-ink">{alert.condition}.</p><p className="mt-0.5 tnum text-xs text-ink-2">Triggered {alert.triggeredAt}</p></div></div><div className="flex shrink-0 items-center gap-2"><button onClick={() => alert.id === deviceAlert?.id ? undefined : acknowledgeDemo(alert.id, "Physical push-button")} title={alert.id === deviceAlert?.id ? "Use the physical device push-button" : "Simulate physical push-button"} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-sm text-ink-2 transition-colors hover:text-ink"><Fingerprint width={15} height={15} />Push-button</button><button disabled={acknowledgingId === alert.id} onClick={() => void acknowledgeCurrent(alert.id)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-danger px-4 text-sm font-semibold text-white transition-colors hover:brightness-105 disabled:cursor-wait disabled:opacity-60"><Check width={16} height={16} />{acknowledgingId === alert.id ? "Acknowledging…" : "Acknowledge"}</button></div></div>)}</div>}</section>

      <div ref={cameraRef} className="grid scroll-mt-[90px] grid-cols-1 gap-5 lg:grid-cols-12"><Card className="lg:col-span-8"><CardHead title="Live Camera" icon={<Camera width={16} height={16} />} aside={<div className="flex items-center gap-3"><span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2"><span className="h-2 w-2 rounded-full bg-danger animate-live-dot" />{connectionConfig[connection].label} · {deviceState?.occurredAt.slice(11, 19) ?? "14:32:08"}</span><button onClick={() => { if (cameraDegraded && deviceCameraUrl) setCameraRetry((value) => value + 1); setCameraDegraded((current) => !current); }} className="text-[13px] text-ink-2 transition-colors hover:text-ink">{cameraDegraded ? "Restore" : "Drop frame"}</button></div>} /><div className="p-6 pt-4"><div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-soft"><img src={CAMERA_IMG} alt="Last available view of the RoboFusion monitoring bay" className={`h-full w-full object-cover ${cameraWarning ? "brightness-95 saturate-[0.9]" : ""}`} />{deviceCameraUrl && <img key={cameraRetry} src={deviceCameraUrl} alt="Live view from the RoboFusion device" onLoad={() => setCameraDegraded(false)} onError={(event) => { event.currentTarget.style.display = "none"; setCameraDegraded(true); }} className={`absolute inset-0 h-full w-full object-cover ${cameraDegraded ? "brightness-95 saturate-[0.9]" : ""}`} />}<div className="absolute left-4 top-4 flex flex-wrap items-center gap-2"><span className="rounded-full bg-card/90 p-0.5 pr-0.5 shadow-sm backdrop-blur"><PresenceBadge presence={currentPresence} /></span><span className="rounded-full bg-card/90 p-0.5 shadow-sm backdrop-blur"><MarkerBadge marker={currentMarker} /></span></div>{cameraWarning && <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-ink/70 px-4 py-2.5 text-xs text-white backdrop-blur-sm"><AlertTriangle width={14} height={14} />{deviceCameraUrl ? "Showing last good frame · New frame unavailable" : "Camera URL is not configured · Showing design fallback"}</div>}</div></div></Card><div className="space-y-5 lg:col-span-4"><Card className="p-6"><div className="flex items-center justify-between"><h2 className="text-[16px] font-semibold text-ink">Presence</h2><PresenceBadge presence={currentPresence} /></div><div className="mt-3 flex items-end gap-1.5"><span className="text-[42px] font-semibold leading-none text-ink">{currentPresence === "OCCUPIED" ? "Occupied" : currentPresence === "EMPTY" ? "Empty" : "Unknown"}</span></div><div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-soft"><div className={`h-full rounded-full ${currentPresence === "UNKNOWN" ? "w-1/3 bg-warn" : "w-full bg-brand"}`} /></div><p className="mt-3 text-[13px] text-ink-2">Device accepts a change only after the state stays stable for ~1s.</p></Card><Card className="p-6"><div className="flex items-center justify-between"><span className="text-[13px] font-medium text-ink-2">Overall Status</span><OverallPill status={currentOverall} /></div><div className="mt-2 flex items-center gap-2.5"><IconCircle tone={currentOverall === "DANGER" ? "danger" : currentOverall === "WARNING" ? "warn" : "brand"}>{currentOverall === "SAFE" ? <ShieldCheck width={19} height={19} /> : <AlertTriangle width={19} height={19} />}</IconCircle><div><div className="text-[22px] font-semibold capitalize text-ink">{currentOverall.toLowerCase()}</div><div className="text-[12px] text-ink-2">Device-authoritative safety state</div></div></div><div className="my-4 h-px bg-line" /><div className="flex items-center justify-between"><span className="text-[13px] font-medium text-ink-2">Early-Warning Trend</span><Pill tone="lime">{currentTrend.charAt(0) + currentTrend.slice(1).toLowerCase()}</Pill></div><p className="mt-1.5 text-[12px] text-ink-2">Trend only · does not activate alarm</p></Card></div></div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Thermometer width={18} height={18} />} label="Temperature" value={temperature} unit="°C" sub={deviceState?.climate.connected === false ? "DHT11 sensor disconnected" : "DHT11 sensor · every 5s"} /><Metric icon={<Droplet width={18} height={18} />} label="Humidity" value={humidity} unit="%" sub={deviceState?.climate.connected === false ? "DHT11 sensor disconnected" : "DHT11 sensor · every 5s"} /><Card className="p-5"><div className="flex items-start justify-between"><IconCircle tone={!irConnected ? "warn" : obstacle ? "danger" : "brand"}><Radar width={18} height={18} /></IconCircle><Pill tone={!irConnected ? "warn" : obstacle ? "danger" : "brand"}>{!irConnected ? "Error" : obstacle ? "Obstacle" : "Clear"}</Pill></div><div className="mt-4 text-[13px] font-medium text-ink-2">IR Obstacle</div><div className="mt-0.5 text-[26px] font-semibold text-ink">{!irConnected ? "Disconnected" : obstacle ? "Obstacle detected" : "No obstacle"}</div><p className="mt-1 text-[12px] text-ink-2">Updated automatically · every 1s</p></Card><Card className="p-5"><div className="flex items-start justify-between"><IconCircle tone="lime"><Tag width={18} height={18} /></IconCircle><span className={`h-6 w-6 rounded-full ring-2 ring-card ${swatch[currentMarker]}`} /></div><div className="mt-4 text-[13px] font-medium text-ink-2">Color Marker</div><div className="mt-0.5 text-[26px] font-semibold capitalize text-ink">{currentMarker.toLowerCase()}</div><div className="mt-2 flex items-center gap-1.5">{[["Red", "bg-danger"], ["Blue", "bg-[#3b82f6]"], ["Yellow", "bg-warn"], ["Green", "bg-brand"]].map(([name, color]) => <span key={name} title={name} className={`h-3 w-3 rounded-full ${color}`} />)}<span className="ml-1 text-[12px] text-ink-2">recognized set</span></div></Card></div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4"><Ops icon={<Database width={16} height={16} />} title="Rolling Memory" value={`${deviceState ? deviceRecords.length : 256} / 256`} pct={Math.round(((deviceState ? deviceRecords.length : 256) / 256) * 100)} note="Oldest in-memory record replaced when a new one arrives." /><Ops icon={<HardDrive width={16} height={16} />} title="Permanent Storage" value={deviceState ? deviceState.storage ? `${Math.round(deviceState.storage.usedBytes / 1024)} / ${Math.round(deviceState.storage.limitBytes / 1024)} KB` : "Not reported" : "142 / 160 KB"} pct={deviceState ? deviceState.storage ? Math.min(100, Math.round((deviceState.storage.usedBytes / deviceState.storage.limitBytes) * 100)) : undefined : 89} tone="warn" note="Device-owned persistent storage; MongoDB is only a mirror." /><Ops icon={<Trash width={16} height={16} />} title="Cleared Data" value={deviceState ? deviceState.storage?.clearedRecords.toLocaleString() ?? "Not reported" : "1,248"} note="Records cleared by the device to maintain its limit." /><Ops icon={<Sync width={16} height={16} />} title="Synchronization" value={connectionConfig[connection].label} note="Original device order · stable event IDs · server deduplication." /></div>

      <div ref={logsRef} className="scroll-mt-[90px]" /><Card><CardHead title="Live Data Log" icon={<Cpu width={16} height={16} />} aside={<div className="flex items-center gap-2"><div className="relative"><Search width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-2" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search log…" className="input pl-8" aria-label="Search live data log" /></div><Pill>256-record buffer</Pill></div>} /><div className="p-6 pt-4"><RecordsTable rows={logRows} sortDesc={sortDesc} onToggleSort={() => setSortDesc((current) => !current)} highlightNewest={sortDesc && !query} /><p className="mt-2.5 text-[12px] text-ink-2">Showing {logRows.length} records · captured ~every 2s · sorted {sortDesc ? "newest first" : "oldest first"}</p></div></Card>

      <Card><CardHead title="Saved History" icon={<Search width={16} height={16} />} /><div className="p-6 pt-4"><div className="flex flex-wrap items-end gap-3"><Field label="Start (date & time)"><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className="input" /></Field><Field label="End (date & time)"><input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className="input" /></Field><button disabled={historyLoading} onClick={() => void runSearch()} className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60"><Search width={15} height={15} />{historyLoading ? "Searching…" : "Search"}</button><button disabled={historyLoading} onClick={() => void lastTwoMinutes()} className="min-h-[42px] rounded-full border border-line bg-card px-4 text-sm text-ink-2 transition-colors hover:text-ink disabled:cursor-wait disabled:opacity-60">Last 2 minutes</button><button onClick={clearSearch} className="min-h-[42px] rounded-full px-4 text-sm text-ink-2 transition-colors hover:text-ink">Clear</button></div>{historyError && <p role="alert" className="mt-3 text-[13px] text-danger">{historyError}</p>}{results !== null && <div className="mt-5"><div className="mb-2.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-2"><Pill tone="brand">{results.length} results</Pill><span className="tnum">Range {searchedRange}</span></div>{results.length === 0 ? <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line py-16 text-center"><IconCircle tone="neutral"><Search width={18} height={18} /></IconCircle><p className="mt-1 text-sm font-medium text-ink">Nothing found for this time range.</p><p className="text-[13px] text-ink-2">Try widening the range or use “Last 2 minutes”.</p></div> : <RecordsTable rows={results} sortDesc onToggleSort={() => undefined} maxHeight="360px" />}</div>}</div></Card>

      <div ref={alertsRef} className="scroll-mt-[90px]" /><Card><CardHead title="Alert Acknowledgement Log" icon={<AlertTriangle width={16} height={16} />} /><div className="p-6 pt-4"><div className="overflow-hidden rounded-2xl border border-line"><div className="overflow-auto"><table className="w-full min-w-[820px] border-collapse text-sm"><thead><tr className="bg-soft text-left text-[12px] font-medium text-ink-2"><th className="px-5 py-3">Alert ID</th><th className="px-5 py-3">Danger triggered at</th><th className="px-5 py-3">Triggering condition</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Acknowledged at</th><th className="px-5 py-3">Method</th></tr></thead><tbody>{[...visibleAlerts, ...visibleLog].map((alert) => <tr key={alert.id} className="border-t border-line hover:bg-soft/70"><td className="px-5 py-3.5 tnum font-medium text-brand-strong">{alert.id}</td><td className="px-5 py-3.5 tnum text-ink-2">{alert.triggeredAt}</td><td className="px-5 py-3.5 text-ink">{alert.condition}</td><td className="px-5 py-3.5">{alert.status === "ACKNOWLEDGED" ? <Pill tone="brand"><Check width={12} height={12} />Acknowledged</Pill> : <Pill tone="warn">Awaiting</Pill>}</td><td className="px-5 py-3.5 tnum text-ink-2">{alert.acknowledgedAt ?? "—"}</td><td className="px-5 py-3.5">{alert.method ? <Pill tone={alert.method === "Dashboard" ? "lime" : "neutral"}>{alert.method === "Physical push-button" && <Fingerprint width={12} height={12} />}{alert.method}</Pill> : <span className="text-ink-2">—</span>}</td></tr>)}</tbody></table></div></div><p className="mt-2.5 text-[12px] text-ink-2">Each alert is tracked by unique ID — acknowledging one never affects another. No global “acknowledge all”.</p></div></Card>

      <footer className="pb-10 pt-2 text-center text-[12px] text-ink-2">RoboFusion Monitor · Next.js dashboard · separate ESP32-S3-CAM fallback surface</footer>
    </main>
  </div>;
}
