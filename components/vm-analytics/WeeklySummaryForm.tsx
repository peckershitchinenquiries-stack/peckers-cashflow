"use client";

import { useState, useEffect } from "react";
import type { WeeklySummaryInputRow } from "@/lib/vm-analytics/types";

interface FormData {
  cogs?: number | null;
  cogs_hitchin?: number | null;
  fillings_and_samosas?: number | null;
  packaging_costs?: number | null;
  marketing?: number | null;
  labour_cost?: number | null;
  occupancy_cost?: number | null;
  aggregator_costs?: number | null;
  // Stored as display whole-number (e.g. 65 for 65%) while editing;
  // converted back to decimal (0.65) before saving.
  gross_margin_budget_pct?: number | null;
  labour_budget_pct?: number | null;
}

interface WeeklySummaryFormProps {
  store: string;
  week: string;
  initialData?: WeeklySummaryInputRow | null;
  onSave?: (data: WeeklySummaryInputRow) => void;
}

export function WeeklySummaryForm({
  store,
  week,
  initialData,
  onSave,
}: WeeklySummaryFormProps) {
  const [formData, setFormData] = useState<FormData>({});
  const [isEditing, setIsEditing] = useState(!initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive the label for the cogs_hitchin field based on the selected store.
  const cogsHitchinLabel = store.includes("Stevenage") ? "COGS Hitchin" : "COGS Stevenage";

  useEffect(() => {
    if (initialData) {
      setFormData({
        cogs: initialData.cogs ? parseFloat(String(initialData.cogs)) : null,
        cogs_hitchin: initialData.cogs_hitchin ? parseFloat(String(initialData.cogs_hitchin)) : null,
        fillings_and_samosas: initialData.fillings_and_samosas ? parseFloat(String(initialData.fillings_and_samosas)) : null,
        packaging_costs: initialData.packaging_costs ? parseFloat(String(initialData.packaging_costs)) : null,
        marketing: initialData.marketing ? parseFloat(String(initialData.marketing)) : null,
        labour_cost: initialData.labour_cost ? parseFloat(String(initialData.labour_cost)) : null,
        occupancy_cost: initialData.occupancy_cost ? parseFloat(String(initialData.occupancy_cost)) : null,
        aggregator_costs: initialData.aggregator_costs ? parseFloat(String(initialData.aggregator_costs)) : null,
        // Stored as decimal in DB (0.65); display as whole number (65) while editing.
        gross_margin_budget_pct: initialData.gross_margin_budget_pct
          ? parseFloat(String(initialData.gross_margin_budget_pct)) * 100
          : null,
        labour_budget_pct: initialData.labour_budget_pct
          ? parseFloat(String(initialData.labour_budget_pct)) * 100
          : null,
      });
    }
  }, [initialData]);

  const handleChange = (field: keyof FormData, value: string) => {
    const numValue = value === "" ? null : parseFloat(value);
    setFormData((prev) => ({ ...prev, [field]: numValue }));
    setError(null);
  };

  const handleSave = async () => {
    try {
      setError(null);
      setIsSaving(true);

      const pctToDecimal = (v: number | null | undefined) => {
        if (v == null) return null;
        return v > 1 ? v / 100 : v;
      };

      const method = initialData ? "PUT" : "POST";
      const url = initialData
        ? `/api/vm-analytics/weekly-summary?store=${encodeURIComponent(store)}&week=${week}`
        : "/api/vm-analytics/weekly-summary";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store,
          week_start_iso: week,
          ...formData,
          gross_margin_budget_pct: pctToDecimal(formData.gross_margin_budget_pct),
          labour_budget_pct: pctToDecimal(formData.labour_budget_pct),
        }),
      });

      if (!response.ok) {
        const error_data = await response.json();
        throw new Error(error_data.error || "Failed to save data");
      }

      const { data } = await response.json();
      onSave?.(data);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  const renderCurrencyInput = (label: string, field: keyof FormData) => {
    const value = formData[field];
    const displayValue = value === null || value === undefined ? "" : value;

    if (!isEditing) {
      return (
        <div className="flex justify-between py-2 px-3 bg-surface-hover rounded">
          <span className="text-sm text-text-secondary">{label}</span>
          <span className="font-mono text-sm font-medium">£{(Number(value) || 0).toFixed(2)}</span>
        </div>
      );
    }

    return (
      <div className="flex gap-2 items-center py-2">
        <label className="text-sm font-medium text-text-secondary w-48">{label}</label>
        <input
          type="number"
          step="0.01"
          value={displayValue}
          onChange={(e) => handleChange(field, e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          placeholder="0.00"
          className="flex-1 px-3 py-2 rounded border border-border bg-bg text-text-primary text-sm font-mono"
        />
        <span className="text-sm text-text-muted">£</span>
      </div>
    );
  };

  const renderPctInput = (label: string, field: keyof FormData) => {
    const value = formData[field];
    const displayValue = value === null || value === undefined ? "" : value;

    if (!isEditing) {
      return (
        <div className="flex justify-between py-2 px-3 bg-surface-hover rounded">
          <span className="text-sm text-text-secondary">{label}</span>
          <span className="font-mono text-sm font-medium">{(Number(value) || 0).toFixed(2)}%</span>
        </div>
      );
    }

    return (
      <div className="space-y-1 py-2">
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-text-secondary w-48">{label}</label>
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={displayValue}
            onChange={(e) => handleChange(field, e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="e.g. 65"
            className="flex-1 px-3 py-2 rounded border border-border bg-bg text-text-primary text-sm font-mono"
          />
          <span className="text-sm text-text-muted">%</span>
        </div>
        <p className="text-xs text-text-muted ml-48 pl-2">Enter as a whole number, e.g. 65 for 65%</p>
      </div>
    );
  };

  return (
    <div className="vm-card p-6 space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Manager Inputs</h3>
        {!isEditing && initialData && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 rounded bg-primary text-white text-sm font-medium hover:bg-primary/90 transition"
          >
            Edit
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
          COGS & Sales
        </div>
        {renderCurrencyInput("COGS (Cost of Goods)", "cogs")}
        {renderCurrencyInput(cogsHitchinLabel, "cogs_hitchin")}
        {renderCurrencyInput("Fillings & Samosas Revenue", "fillings_and_samosas")}

        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3 mt-5">
          Operating Costs
        </div>
        {renderCurrencyInput("Packaging Costs", "packaging_costs")}
        {renderCurrencyInput("Marketing", "marketing")}
        {renderCurrencyInput("Labour Cost", "labour_cost")}
        {renderCurrencyInput("Occupancy Cost", "occupancy_cost")}
        {renderCurrencyInput("Aggregator Costs (Commission)", "aggregator_costs")}

        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3 mt-5">
          Budget Targets
        </div>
        {renderPctInput("Gross Margin Budget %", "gross_margin_budget_pct")}
        {renderPctInput("Labour Budget %", "labour_budget_pct")}
      </div>

      {isEditing && (
        <div className="flex gap-2 pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => initialData ? setIsEditing(false) : window.history.back()}
            disabled={isSaving}
            className="px-4 py-2 rounded border border-border text-text-primary font-medium hover:bg-surface-hover disabled:opacity-50 transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
