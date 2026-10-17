import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useApi } from "../contexts/ApiContext";
import { useThresholds } from "../contexts/ThresholdContext";
import { ShieldAlert } from "lucide-react";
import EnergyLoader from "../components/EnergyLoader";
import { useDialog } from "../contexts/DialogContext";

// Kartu threshold, urutan dan judul mengikuti halaman settings web lama.
// fields: [kolom transformer_settings, label, nilai default (null = tidak ada default)].
// min/max/step = rentang slider web lama. signed = tampilkan "-" untuk Low dan "+" untuk High
// (nilai adalah deviasi % dari nominal).
const GROUPS = [
  {
    key: "voltage",
    title: "Voltage Profile Settings",
    unit: "%",
    signed: true,
    min: 1,
    max: 15,
    step: 1,
    fields: [
      ["voltageLowTripTreshold", "Low Trip", 10],
      ["voltageLowAlarmTreshold", "Low Alarm", 5],
      ["voltageHighAlarmTreshold", "High Alarm", 5],
      ["voltageHighTripTreshold", "High Trip", 10],
    ],
    computed: [
      ["voltageLowTripValue", "Low Trip"],
      ["voltageLowAlarmValue", "Low Alarm"],
      ["voltageHighAlarmValue", "High Alarm"],
      ["voltageHighTripValue", "High Trip"],
    ],
  },
  {
    key: "frequency",
    title: "Frequency Profile Settings",
    unit: "%",
    signed: true,
    min: 1,
    max: 15,
    step: 1,
    fields: [
      ["frequencyLowTripTreshold", "Low Trip", 10],
      ["frequencyLowAlarmTreshold", "Low Alarm", 5],
      ["frequencyHighAlarmTreshold", "High Alarm", 5],
      ["frequencyHighTripTreshold", "High Trip", 10],
    ],
  },
  {
    key: "thd",
    title: "THD Threshold Profile Settings",
    unit: "%",
    min: 1,
    max: 100,
    step: 1,
    fields: [
      ["thdCurrentTripTreshold", "Current Trip", 10],
      ["thdCurrentAlarmTreshold", "Current Alarm", 5],
      ["thdVoltageAlarmTreshold", "Voltage Alarm", 5],
      ["thdVoltageTripTreshold", "Voltage Trip", 10],
    ],
  },
  {
    key: "topOil",
    title: "Top Oil Profile Settings",
    unit: "°C",
    min: 1,
    max: 100,
    step: 1,
    fields: [
      ["topOilHighAlarmTreshold", "High Alarm", 70],
      ["topOilHighTripTreshold", "High Trip", 80],
    ],
  },
  {
    key: "windTemp",
    title: "Winding Temperature Profile Settings",
    unit: "°C",
    min: 1,
    max: 100,
    step: 1,
    fields: [
      ["windTempHighAlarmTreshold", "High Alarm", 88],
      ["windTempHighTripTreshold", "High Trip", 98],
    ],
  },
  {
    key: "powerFactor",
    title: "Power Factor Profile Settings",
    unit: "",
    min: 0,
    max: 1,
    step: 0.01,
    fields: [
      ["powerFactorLowAlarmTreshold", "Low Alarm", null],
      ["powerFactorLowTripTreshold", "Low Trip", null],
    ],
  },
  {
    key: "current",
    title: "Current Profile Settings",
    unit: "%",
    min: 1,
    max: 200,
    step: 1,
    fields: [
      ["currentHighAlarmTreshold", "High Alarm", null],
      ["currentHighTripTreshold", "High Trip", null],
    ],
  },
  {
    key: "neutralCurrent",
    title: "Neutral Current Profile Settings",
    unit: "A",
    min: 1,
    max: 200,
    step: 1,
    fields: [
      ["IneutralHighAlarmTreshold", "High Alarm", 100],
      ["IneutralHighTripTreshold", "High Trip", 150],
    ],
  },
  {
    key: "busTemp",
    title: "Bus Bar Temp. Profile Settings",
    unit: "°C",
    min: 1,
    max: 100,
    step: 1,
    fields: [
      ["busTempHighAlarmTreshold", "High Alarm", null],
      ["busTempHighTripTreshold", "High Trip", null],
    ],
  },
  {
    key: "tankPressure",
    title: "Tank Pressure Profile Settings",
    unit: "Bar",
    min: 0.5,
    max: 1,
    step: 0.01,
    fields: [
      ["tankPressureHighAlarmTreshold", "High Alarm", null],
      ["tankPressureHighTripTreshold", "High Trip", null],
    ],
  },
  {
    key: "voltageUnbalance",
    title: "Voltage (Unbalance) Profile Settings",
    unit: "%",
    signed: true,
    min: 1,
    max: 15,
    step: 1,
    fields: [
      ["voltageUnbalanceHighAlarmTreshold", "High Alarm", null],
      ["voltageUnbalanceHighTripTreshold", "High Trip", null],
    ],
  },
  // Dua kartu di bawah tidak ada di web lama, tapi kolomnya ada dan dipakai Raspi.
  {
    key: "h2",
    title: "Hydrogen (H2) Profile Settings",
    unit: "ppm",
    min: 0,
    max: 200,
    step: 1,
    fields: [
      ["H2ppmHighAlarmTreshold", "High Alarm", null],
      ["H2ppmHighTripTreshold", "High Trip", null],
    ],
  },
  {
    key: "moisture",
    title: "Moisture Profile Settings",
    unit: "ppm",
    min: 0,
    max: 50,
    step: 1,
    fields: [
      ["MoistureppmHighAlarmTreshold", "High Alarm", null],
      ["MoistureppmHighTripTreshold", "High Trip", null],
    ],
  },
];

// Kartu Trip Actuator: [kolom trip_settings, label]. Nilai 0/1/2 dibaca Raspi
// (toolboxTMU.py): 0 = hanya alarm, 1 = relay trip HV, 2 = relay trip LV.
const TRIP_ITEMS = [
  ["voltage", "Voltage"],
  ["voltageUnbalance", "Voltage Unbalance"],
  ["frequency", "Frequency"],
  ["topOilTemp", "Oil Temperature"],
  ["busTemp", "Bus Temperature"],
  ["powerFactor", "Power Factor"],
  ["current", "Current"],
  ["pressure", "Pressure"],
  ["oilLevel", "Oil Level"],
  ["WTITemp", "WTI Temperature"],
  ["THDCurrent", "THD Current"],
  ["THDVoltage", "THD Voltage"],
  ["Ineutral", "Neutral Current"],
  ["H2ppm", "Hydrogen (H2)"],
  ["Moistureppm", "Moisture"],
];

const TRIP_OPTIONS = [
  [0, "Do Nothing"],
  [1, "HV Trip"],
  [2, "LV Trip"],
];

const show = (v, unit) =>
  v === null || v === undefined
    ? "-"
    : `${v}${unit ? ` ${unit.split(" ")[0]}` : ""}`;

const toStr = (v) => (v === null || v === undefined ? "" : String(v));

const draftOf = (s, groups) => {
  const d = {};
  for (const g of groups) {
    for (const [col] of g.fields) {
      d[col] = toStr(s?.[col]);
    }
  }
  return d;
};

// Satu kolom seperti web lama: slider vertikal + kotak angka. Keduanya membaca
// dan menulis value yang sama, jadi selalu sinkron tanpa event tambahan.
const SliderField = ({
  label,
  value,
  min,
  max,
  step,
  prefix,
  unit,
  disabled,
  onChange,
}) => (
  <div className="flex flex-col items-center gap-2 w-24">
    <span className="text-[11px] font-bold uppercase text-gray-500 text-center">
      {label}
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value === "" ? min : value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-40 accent-blue-600 cursor-pointer disabled:cursor-default disabled:opacity-50"
      style={{ writingMode: "vertical-lr", direction: "rtl" }}
    />
    <div className="flex items-center gap-1 text-sm text-gray-500">
      {prefix && <span>{prefix}</span>}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-16 text-center bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg px-1 py-1 font-bold text-[#172b4d] dark:text-white outline-none focus:border-blue-500 disabled:opacity-70"
      />
      {unit && <span>{unit}</span>}
    </div>
  </div>
);

const Settings = () => {
  const { apiUrl } = useApi();
  const { refreshThresholds } = useThresholds();
  const { confirm } = useDialog();
  const role = (sessionStorage.getItem("role") || "").toLowerCase();
  const canEdit = role === "admin" || role === "superuser";
  const trafoId = sessionStorage.getItem("selectedTrafoId") || "1";

  const [settings, setSettings] = useState(null);
  const [trip, setTrip] = useState(null);
  const [tripDraft, setTripDraft] = useState({}); // { kolom trip: 0/1/2 }
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({}); // { kolom: string }
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${apiUrl}/api/settings/thresholds`, {
        params: { trafo_id: trafoId },
      });
      setSettings(res.data.settings);
      setDraft(draftOf(res.data.settings, GROUPS));
      setTrip(res.data.trip);
      setTripDraft(res.data.trip || {});
      setError(
        res.data.settings
          ? ""
          : "This transformer does not have settings configured yet (awaiting Raspi registration).",
      );
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, trafoId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (g, values) => {
    const body = {};
    for (const [col] of g.fields) {
      const raw = String(values[col] ?? "").trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        setNotice(`Value for ${col} must be a number`);
        return;
      }
      body[col] = n;
    }
    if (Object.keys(body).length === 0) return;
    try {
      const res = await axios.put(
        `${apiUrl}/api/settings/thresholds/${trafoId}`,
        body,
      );
      setSettings(res.data.settings);
      setNotice("");
      await refreshThresholds();
      window.dispatchEvent(new Event("thresholdsUpdated"));
    } catch (err) {
      setDraft((d) => ({ ...d, ...draftOf(settings, [g]) }));
      setNotice(err.response?.data?.error || "Failed to save settings");
    }
  };

  const saveTimers = useRef({});
  const editField = (g, col, v) => {
    const next = { ...draft, [col]: v };
    setDraft(next);
    clearTimeout(saveTimers.current[g.key]);
    saveTimers.current[g.key] = setTimeout(() => save(g, next), 800);
  };

  const setDefault = async (g) => {
    if (
      !(await confirm(`You will reset the ${g.title} to default values`, {
        title: "Are you sure?",
      }))
    )
      return;
    const next = { ...draft };
    for (const [col, , def] of g.fields) {
      if (def !== null) next[col] = String(def);
    }
    setDraft(next);
    clearTimeout(saveTimers.current[g.key]);
    save(g, next);
  };

  const changeTrip = async (col, value) => {
    setTripDraft((d) => ({ ...d, [col]: value }));
    try {
      setSaving(true);
      const res = await axios.put(`${apiUrl}/api/settings/trip/${trafoId}`, {
        [col]: value,
      });
      setTrip(res.data.trip);
      setTripDraft(res.data.trip);
      setNotice("");
    } catch (err) {
      setTripDraft(trip);
      setNotice(err.response?.data?.error || "Failed to save trip settings");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <EnergyLoader text="Loading Settings..." />
      </div>
    );

  return (
    <div className="flex flex-col gap-5 animate-[fadeIn_0.5s_ease-out] w-full pb-10">
      <div>
        <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1">
          Threshold settings
        </h2>
        <p className="text-[#5e6c84] dark:text-[#94a3b8] text-[0.95rem]">
          Batas alarm dan trip per parameter untuk trafo {trafoId}. Nilai
          tegangan absolut dihitung server dari rated LV.
          {!canEdit && " Anda hanya dapat melihat."}
        </p>
      </div>
      {error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 px-4 py-3 text-sm flex items-center gap-2">
          <ShieldAlert size={16} /> {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 px-4 py-2 text-sm">
          {notice}
        </div>
      )}
      {settings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {GROUPS.map((g) => {
            return (
              <div
                key={g.key}
                className="rounded-2xl border p-4 bg-white dark:bg-[#151521] border-[#dfe1e6] dark:border-white/10"
              >
                <div className="font-bold text-[#172b4d] dark:text-white mb-3">
                  {g.title}
                </div>
                <div className="flex flex-wrap justify-center gap-6">
                  {g.fields.map(([col, label]) => (
                    <SliderField
                      key={col}
                      label={label}
                      value={draft[col] ?? ""}
                      min={g.min}
                      max={g.max}
                      step={g.step}
                      prefix={
                        g.signed ? (label.startsWith("Low") ? "-" : "+") : ""
                      }
                      unit={g.unit}
                      disabled={!canEdit}
                      onChange={(v) => editField(g, col, v)}
                    />
                  ))}
                </div>
                {canEdit && g.fields.some(([, , def]) => def !== null) && (
                  <div className="flex justify-center mt-4">
                    <button
                      type="button"
                      onClick={() => setDefault(g)}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
                    >
                      Set To Default
                    </button>
                  </div>
                )}
                {g.computed && (
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {g.computed.map(([col, label]) => (
                      <div key={col} className="flex flex-col">
                        <span className="text-[10px] uppercase text-gray-400">
                          {label} (V)
                        </span>
                        <span className="text-sm font-mono text-[#172b4d] dark:text-gray-200">
                          {show(settings[col], "")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {trip && (
        <div className="rounded-2xl border p-4 bg-white dark:bg-[#151521] border-[#dfe1e6] dark:border-white/10">
          <div className="font-bold text-[#172b4d] dark:text-white mb-3">
            Trip Actuator Settings
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {TRIP_ITEMS.map(([col, label]) => (
              <label
                key={col}
                className="flex items-center justify-between gap-4 text-sm text-[#172b4d] dark:text-gray-200"
              >
                <span>{label}</span>
                <select
                  value={Number(tripDraft[col] ?? 0)}
                  disabled={!canEdit || saving}
                  onChange={(e) =>
                    changeTrip(col, Number(e.target.value))
                  }
                  className="w-40 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-500 disabled:opacity-70"
                >
                  {TRIP_OPTIONS.map(([v, text]) => (
                    <option
                      key={v}
                      value={v}
                      className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white"
                    >
                      {text}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
