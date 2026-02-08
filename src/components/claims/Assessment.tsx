import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUpdateClaimSilent, type Claim } from "@/hooks/useClaims";

// -------------------- Types --------------------
type SpareRow = {
  invoice_no: string;    // numeric-only string
  description: string;
  quantity: number;
  estimated_amount: number;
  assessed_glass: number;
  assessed_plastic_rubber: number;
  assessed_others_metal: number;
  remarks: string;
};
type SpareTotals = {
  cgst_percent: number;
  sgst_percent: number;
  dep_glass_percent: number;
  dep_plastic_percent: number;
  dep_metal_percent: number;

  qty_total: number;
  estimated_total: number;
  assessed_glass_total: number;
  assessed_plastic_total: number;
  assessed_metal_total: number;
  assessed_total: number;

  cgst_amount: number;
  sgst_amount: number;
  total_with_gst: number;

  dep_glass_amount: number;
  dep_plastic_amount: number;
  dep_metal_amount: number;
  depreciation_total: number;

  net_amount: number;
};

type LabourRow = {
  invoice_no: string;    // numeric-only string
  description: string;
  estimated_amount: number;
  assessed_amount: number;
  remarks: string;
};
type LabourTotals = {
  cgst_percent: number;
  sgst_percent: number;
  imt_percent: number;      // editable; set 0 if you don't want it

  estimated_total: number;
  assessed_total: number;

  cgst_amount: number;
  sgst_amount: number;
  total_with_gst: number;

  imt_deduction: number;
  final_total: number;
};

type HeaderFields = {
  report_ref_no: string;
  insured_and_regn: string;
  policy_inception_date: string;
  registration_date: string;
  date_of_accident: string;
  on_road_age: string;
  age_depreciation_rate: string;
  annotation: string;
};

type Summary = {
  // read-only computed fields (kept for export/use in formulas)
  total_spare_assessed: number;
  total_labour_assessed: number;
  gross_estimated: number;  // labour estimated (from labour.totals.estimated_total)
  gross_assessed: number;   // spare assessed_total + labour assessed_total
  dep_glass_amount: number;
  dep_plastic_amount: number;
  dep_metal_amount: number;
  imt_spares_deduction: number; // 0 (not considered) – kept for structure
  imt_labour_deduction: number;
  net_after_dep_imt: number;
  salvage_value: number;     // editable
  policy_excess: number;     // editable
  final_net_liability: number;
};

type AssessmentRoot = {
  assessment: {
    header: HeaderFields;
    spare: {
      new_spares: SpareRow[];
      supplementary: SpareRow[];
      totals: SpareTotals;
    };
    labour: {
      main: LabourRow[];
      supplementary: LabourRow[];
      totals: LabourTotals;
    };
    summary: Summary;
  };
};

interface Props {
  claim: Claim;
}

// -------------------- Helpers --------------------
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const EMPTY_SPARE_ROW: SpareRow = {
  invoice_no: "",
  description: "",
  quantity: 0,
  estimated_amount: 0,
  assessed_glass: 0,
  assessed_plastic_rubber: 0,
  assessed_others_metal: 0,
  remarks: "",
};
const EMPTY_LABOUR_ROW: LabourRow = {
  invoice_no: "",
  description: "",
  estimated_amount: 0,
  assessed_amount: 0,
  remarks: "",
};

// -------------------- Component --------------------
export const Assessment = ({ claim }: Props) => {
  const updateClaim = useUpdateClaimSilent();

  // ---------- defaults (blank-safe) ----------
  const defaults: AssessmentRoot = useMemo(() => {
    const existing = (claim.sections as any)?.assessment as AssessmentRoot["assessment"] | undefined;

    const headerDefaults: HeaderFields = existing?.header ?? {
      report_ref_no: claim.claim_number || "",
      insured_and_regn:
        `${(claim.sections as any)?.insured_name ?? ""}`.trim() +
        (claim.sections?.vehicle_regn_no ? `, ${claim.sections.vehicle_regn_no}` : ""),
      policy_inception_date: (claim.sections as any)?.policy_inception_date ?? "",
      registration_date: (claim.sections as any)?.registration_date ?? "",
      date_of_accident: (claim.sections as any)?.date_of_accident ?? "",
      on_road_age: (claim.sections as any)?.on_road_age ?? "",
      age_depreciation_rate: (claim.sections as any)?.age_depreciation_rate ?? "",
      annotation:
        existing?.header?.annotation ?? "Annotation to below assessment calculations...",
    };

    const spareDefaults: SpareTotals = existing?.spare?.totals ?? {
      cgst_percent: 0,
      sgst_percent: 0,
      dep_glass_percent: 0,
      dep_plastic_percent: 0,
      dep_metal_percent: 0,

      qty_total: 0,
      estimated_total: 0,
      assessed_glass_total: 0,
      assessed_plastic_total: 0,
      assessed_metal_total: 0,
      assessed_total: 0,

      cgst_amount: 0,
      sgst_amount: 0,
      total_with_gst: 0,

      dep_glass_amount: 0,
      dep_plastic_amount: 0,
      dep_metal_amount: 0,
      depreciation_total: 0,

      net_amount: 0,
    };

    const labourDefaults: LabourTotals = existing?.labour?.totals ?? {
      cgst_percent: 0,
      sgst_percent: 0,
      imt_percent: 0,

      estimated_total: 0,
      assessed_total: 0,

      cgst_amount: 0,
      sgst_amount: 0,
      total_with_gst: 0,

      imt_deduction: 0,
      final_total: 0,
    };

    const summaryDefaults: Summary = existing?.summary ?? {
      total_spare_assessed: 0,
      total_labour_assessed: 0,
      gross_estimated: 0,
      gross_assessed: 0,
      dep_glass_amount: 0,
      dep_plastic_amount: 0,
      dep_metal_amount: 0,
      imt_spares_deduction: 0,
      imt_labour_deduction: 0,
      net_after_dep_imt: 0,
      salvage_value: 0,
      policy_excess: 0,
      final_net_liability: 0,
    };

    return {
      assessment: {
        header: headerDefaults,
        spare: {
          new_spares: existing?.spare?.new_spares ?? [],
          supplementary: existing?.spare?.supplementary ?? [],
          totals: spareDefaults,
        },
        labour: {
          main: existing?.labour?.main ?? [],
          supplementary: existing?.labour?.supplementary ?? [],
          totals: labourDefaults,
        },
        summary: summaryDefaults,
      },
    };
  }, [claim]);

  // ---------- form ----------
  const { register, control, watch, setValue, getValues } = useForm<AssessmentRoot>({
    defaultValues: defaults,
  });

  // ---------- field arrays ----------
  const spareNew = useFieldArray({ control, name: "assessment.spare.new_spares" });
  const spareSup = useFieldArray({ control, name: "assessment.spare.supplementary" });
  const labMain = useFieldArray({ control, name: "assessment.labour.main" });
  const labSup = useFieldArray({ control, name: "assessment.labour.supplementary" });

  // ---------- dropdowns with indicators ----------
  const [openSpare, setOpenSpare] = useState(true);
  const [openLabour, setOpenLabour] = useState(false);
  const [openSummary, setOpenSummary] = useState(false);

  // ---------- exclusive logic (spare) ----------
  const handleExclusiveSpare = (
    table: "assessment.spare.new_spares" | "assessment.spare.supplementary",
    index: number,
    field: "assessed_glass" | "assessed_plastic_rubber" | "assessed_others_metal",
    raw: string
  ) => {
    const val = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(val)) return;
    const base = `${table}.${index}` as const;
    (["assessed_glass", "assessed_plastic_rubber", "assessed_others_metal"] as const).forEach((f) =>
      setValue(`${base}.${f}`, 0, { shouldDirty: true, shouldValidate: false })
    );
    setValue(`${base}.${field}`, val, { shouldDirty: true, shouldValidate: true });
  };

  // ---------- calculations: spare ----------
  const spareRows = [
    ...(watch("assessment.spare.new_spares") || []),
    ...(watch("assessment.spare.supplementary") || []),
  ];
  const sparePerc = watch([
    "assessment.spare.totals.cgst_percent",
    "assessment.spare.totals.sgst_percent",
    "assessment.spare.totals.dep_glass_percent",
    "assessment.spare.totals.dep_plastic_percent",
    "assessment.spare.totals.dep_metal_percent",
  ]);

  useEffect(() => {
    const qty_total = r2(spareRows.reduce((a, r) => a + (Number(r.quantity) || 0), 0));
    const estimated_total = r2(spareRows.reduce((a, r) => a + (Number(r.estimated_amount) || 0), 0));
    const assessed_glass_total = r2(spareRows.reduce((a, r) => a + (Number(r.assessed_glass) || 0), 0));
    const assessed_plastic_total = r2(
      spareRows.reduce((a, r) => a + (Number(r.assessed_plastic_rubber) || 0), 0)
    );
    const assessed_metal_total = r2(
      spareRows.reduce((a, r) => a + (Number(r.assessed_others_metal) || 0), 0)
    );
    const assessed_total = r2(assessed_glass_total + assessed_plastic_total + assessed_metal_total);

    const [cgstP, sgstP, depGP, depPP, depMP] = sparePerc.map(Number);
    const cgst_amount = r2((assessed_total * (cgstP || 0)) / 100);
    const sgst_amount = r2((assessed_total * (sgstP || 0)) / 100);
    const total_with_gst = r2(assessed_total + cgst_amount + sgst_amount);

    const dep_glass_amount = r2((assessed_glass_total * (depGP || 0)) / 100);
    const dep_plastic_amount = r2((assessed_plastic_total * (depPP || 0)) / 100);
    const dep_metal_amount = r2((assessed_metal_total * (depMP || 0)) / 100);
    const depreciation_total = r2(dep_glass_amount + dep_plastic_amount + dep_metal_amount);

    const net_amount = r2(total_with_gst - depreciation_total);

    const patch = (k: keyof SpareTotals, v: number) =>
      setValue(`assessment.spare.totals.${k}`, v, { shouldDirty: false, shouldValidate: false });
    patch("qty_total", qty_total);
    patch("estimated_total", estimated_total);
    patch("assessed_glass_total", assessed_glass_total);
    patch("assessed_plastic_total", assessed_plastic_total);
    patch("assessed_metal_total", assessed_metal_total);
    patch("assessed_total", assessed_total);
    patch("cgst_amount", cgst_amount);
    patch("sgst_amount", sgst_amount);
    patch("total_with_gst", total_with_gst);
    patch("dep_glass_amount", dep_glass_amount);
    patch("dep_plastic_amount", dep_plastic_amount);
    patch("dep_metal_amount", dep_metal_amount);
    patch("depreciation_total", depreciation_total);
    patch("net_amount", net_amount);
  }, [spareRows, sparePerc, setValue]);

  // ---------- calculations: labour ----------
  const labourRows = [
    ...(watch("assessment.labour.main") || []),
    ...(watch("assessment.labour.supplementary") || []),
  ];
  const labourPerc = watch([
    "assessment.labour.totals.cgst_percent",
    "assessment.labour.totals.sgst_percent",
    "assessment.labour.totals.imt_percent",
  ]);

  useEffect(() => {
    const estimated_total = r2(labourRows.reduce((a, r) => a + (Number(r.estimated_amount) || 0), 0));
    const assessed_total = r2(labourRows.reduce((a, r) => a + (Number(r.assessed_amount) || 0), 0));

    const [cgstP, sgstP, imtP] = labourPerc.map(Number);
    const cgst_amount = r2((assessed_total * (cgstP || 0)) / 100);
    const sgst_amount = r2((assessed_total * (sgstP || 0)) / 100);
    const total_with_gst = r2(assessed_total + cgst_amount + sgst_amount);

    const imt_deduction = r2((assessed_total * (imtP || 0)) / 100);
    const final_total = r2(total_with_gst - imt_deduction);

    const patch = (k: keyof LabourTotals, v: number) =>
      setValue(`assessment.labour.totals.${k}`, v, { shouldDirty: false, shouldValidate: false });
    patch("estimated_total", estimated_total);
    patch("assessed_total", assessed_total);
    patch("cgst_amount", cgst_amount);
    patch("sgst_amount", sgst_amount);
    patch("total_with_gst", total_with_gst);
    patch("imt_deduction", imt_deduction);
    patch("final_total", final_total);
  }, [labourRows, labourPerc, setValue]);

  // ---------- SUMMARY (auto, read-only except salvage/policy_excess) ----------
  const spareTotals = watch("assessment.spare.totals");
  const labourTotals = watch("assessment.labour.totals");
  const salvageValue = watch("assessment.summary.salvage_value");
  const policyExcess = watch("assessment.summary.policy_excess");

  // Auto-open summary when there’s data
  useEffect(() => {
    const hasData =
      (spareTotals?.assessed_total || 0) > 0 ||
      (labourTotals?.assessed_total || 0) > 0;
    if (hasData) setOpenSummary(true);
  }, [spareTotals?.assessed_total, labourTotals?.assessed_total]);

  useEffect(() => {
    const total_spare_assessed = r2(spareTotals?.assessed_total || 0);
    const total_labour_assessed = r2(labourTotals?.assessed_total || 0);

    const gross_estimated = r2(labourTotals?.estimated_total || 0); // mirrors your sheet
    const gross_assessed = r2(total_spare_assessed + total_labour_assessed);

    const dep_glass_amount = r2(spareTotals?.dep_glass_amount || 0);
    const dep_plastic_amount = r2(spareTotals?.dep_plastic_amount || 0);
    const dep_metal_amount = r2(spareTotals?.dep_metal_amount || 0);

    // IMT on spares not considered (kept for completeness)
    const imt_spares_deduction = 0;
    const imt_labour_deduction = r2(labourTotals?.imt_deduction || 0);

    const net_after_dep_imt = r2(
      gross_assessed - (dep_glass_amount + dep_plastic_amount + dep_metal_amount) - imt_labour_deduction
    );

    const final_net_liability = r2(net_after_dep_imt - (Number(salvageValue) || 0) - (Number(policyExcess) || 0));

    const patch = (k: keyof Summary, v: number) =>
      setValue(`assessment.summary.${k}`, v, { shouldDirty: false, shouldValidate: false });

    patch("total_spare_assessed", total_spare_assessed);
    patch("total_labour_assessed", total_labour_assessed);
    patch("gross_estimated", gross_estimated);
    patch("gross_assessed", gross_assessed);
    patch("dep_glass_amount", dep_glass_amount);
    patch("dep_plastic_amount", dep_plastic_amount);
    patch("dep_metal_amount", dep_metal_amount);
    patch("imt_spares_deduction", imt_spares_deduction);
    patch("imt_labour_deduction", imt_labour_deduction);
    patch("net_after_dep_imt", net_after_dep_imt);
    patch("final_net_liability", final_net_liability);
  }, [
    spareTotals,
    labourTotals,
    salvageValue,
    policyExcess,
    setValue,
  ]);

  // ---------- independent auto-saves ----------
  const spareSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const labourSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const summarySaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [savingSpare, setSavingSpare] = useState(false);
  const [savingLabour, setSavingLabour] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);

  // watch spare subtree
  useEffect(() => {
    const sub = watch((_, { name }) => {
      if (!name?.startsWith("assessment.spare")) return;
      if (spareSaveTimer.current) clearTimeout(spareSaveTimer.current);
      setSavingSpare(true);
      spareSaveTimer.current = setTimeout(async () => {
        await updateClaim.mutateAsync({
          id: claim.id,
          updates: { sections: { ...claim.sections, assessment: getValues().assessment } },
        });
        setSavingSpare(false);
      }, 1000);
    });
    return () => sub.unsubscribe();
  }, [watch, claim.id, claim.sections, getValues, updateClaim]);

  // watch labour subtree
  useEffect(() => {
    const sub = watch((_, { name }) => {
      if (!name?.startsWith("assessment.labour")) return;
      if (labourSaveTimer.current) clearTimeout(labourSaveTimer.current);
      setSavingLabour(true);
      labourSaveTimer.current = setTimeout(async () => {
        await updateClaim.mutateAsync({
          id: claim.id,
          updates: { sections: { ...claim.sections, assessment: getValues().assessment } },
        });
        setSavingLabour(false);
      }, 1000);
    });
    return () => sub.unsubscribe();
  }, [watch, claim.id, claim.sections, getValues, updateClaim]);

  // watch summary (only salvage/policy_excess are editable)
  useEffect(() => {
    const sub = watch((_, { name }) => {
      if (!name?.startsWith("assessment.summary")) return;
      if (!name?.endsWith("salvage_value") && !name?.endsWith("policy_excess")) return;
      if (summarySaveTimer.current) clearTimeout(summarySaveTimer.current);
      setSavingSummary(true);
      summarySaveTimer.current = setTimeout(async () => {
        await updateClaim.mutateAsync({
          id: claim.id,
          updates: { sections: { ...claim.sections, assessment: getValues().assessment } },
        });
        setSavingSummary(false);
      }, 1000);
    });
    return () => sub.unsubscribe();
  }, [watch, claim.id, claim.sections, getValues, updateClaim]);

  const handleManualSave = async () => {
    await updateClaim.mutateAsync({
      id: claim.id,
      updates: { sections: { ...claim.sections, assessment: getValues().assessment } },
    });
    toast.success("Assessment saved");
  };

  // ---------- styles ----------
  const css = `
    .assess-table { border-collapse: collapse; width: 100%; border: 1px solid #000; background: #fff; }
    .assess-table th, .assess-table td { border: 1px solid #000; padding: 2px 4px; font-size: 12px; line-height: 1.1; vertical-align: middle; }
    .assess-input, .assess-textarea { width: 100%; border: none; background: transparent; padding: 2px 4px; font-size: 12px; }
    .assess-input:focus, .assess-textarea:focus { outline: 1px solid #4a90e2; }
    .num { text-align: right; font-family: "Courier New", monospace; }
    .center { text-align: center; }
    .scroll-area { max-height: 340px; overflow: auto; }
    .section-title { background:#d9d9d9; font-weight:700; text-align:left; padding:4px 6px; border:1px solid #000; border-bottom:none; }
    .read-only-cell { background-color:#f1f5f9; }
    th.glass-col, td.glass-col { min-width: 90px; }
    th.desc-col, td.desc-col { width: 460px; }
    .totals-row { background:#fff2cc; font-weight:600; }
    details summary { cursor: pointer; list-style: none; }
    details summary::-webkit-details-marker { display:none; }
    .section-toggle { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
    .section-toggle .chev { transition: transform 0.2s ease; margin-right:8px; }
    details[open] .chev { transform: rotate(90deg); }
  `;

  // ---------- render ----------
  return (
    <div className="space-y-3">
      <style>{css}</style>

      {/* Controls */}
      <div className="flex justify-between items-center bg-white p-3 rounded-md border">
        <div className="text-xl font-semibold">Assessment</div>
        <div className="flex items-center gap-3">
          {(savingSpare || savingLabour || savingSummary) && (
            <span className="text-xs text-gray-500 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Auto-saving...
            </span>
          )}
          <Button size="sm" onClick={handleManualSave} className="bg-slate-700 hover:bg-slate-800">
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
        </div>
      </div>

      {/* ===== Header ===== */}
      <Card className="bg-white border-2 border-gray-300">
        <div className="section-title">Annexure-A: Attached to and forming part of Report</div>
        <table className="assess-table">
          <tbody>
            <tr>
              <td className="center" style={{ width: 220 }}>Report Ref. No.</td>
              <td><input className="assess-input" {...register("assessment.header.report_ref_no")} /></td>
              <td className="center" style={{ width: 260 }}>Name of Insured & Vehicle Regn. No.</td>
              <td><input className="assess-input" {...register("assessment.header.insured_and_regn")} /></td>
            </tr>
            <tr>
              <td className="center">Policy Inception Date</td>
              <td><input type="date" className="assess-input" {...register("assessment.header.policy_inception_date")} /></td>
              <td className="center">On Road Age of the Insured Vehicle</td>
              <td><input className="assess-input" {...register("assessment.header.on_road_age")} /></td>
            </tr>
            <tr>
              <td className="center">Registration Date</td>
              <td><input type="date" className="assess-input" {...register("assessment.header.registration_date")} /></td>
              <td className="center">Age Wise Depreciation Rate</td>
              <td><input className="assess-input" {...register("assessment.header.age_depreciation_rate")} /></td>
            </tr>
            <tr>
              <td className="center">Date of Accident</td>
              <td><input type="date" className="assess-input" {...register("assessment.header.date_of_accident")} /></td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={4}>
                <textarea rows={2} className="assess-textarea" {...register("assessment.header.annotation")} />
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* ===== Spare Section (dropdown) ===== */}
      <details open={openSpare} onToggle={(e) => setOpenSpare((e.target as HTMLDetailsElement).open)}>
        <summary>
          <div className="section-toggle">
            <div className="flex items-center">
              <span className="chev">▸</span>
              <span className="font-semibold">Spare Parts Assessment</span>
            </div>
            {savingSpare && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
          </div>
        </summary>

        {/* Spare Tables */}
        {[
          { label: "NEW SPARE PARTS", path: "assessment.spare.new_spares" as const, fa: spareNew },
          { label: "SUPPLEMENTARY ESTIMATE", path: "assessment.spare.supplementary" as const, fa: spareSup },
        ].map(({ label, path, fa }) => (
          <Card key={label} className="bg-white border-2 border-gray-300">
            <div className="section-title">{label}</div>
            <div className="scroll-area">
              <table className="assess-table">
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>Sl.</th>
                    <th style={{ width: 90 }}>Invoice No.</th>
                    <th className="desc-col">Description of New Spares and Quantity</th>
                    <th style={{ width: 70 }}>Qty</th>
                    <th style={{ width: 120 }}>Estimated</th>
                    <th colSpan={3} style={{ width: 320 }}>Assessed Amount</th>
                    <th style={{ width: 220 }}>Remarks</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                  <tr>
                    <th colSpan={5}></th>
                    <th className="glass-col">Glass</th>
                    <th>Plastic/Rub.</th>
                    <th>Others/Metal</th>
                    <th colSpan={2}></th>
                  </tr>
                </thead>
                <tbody>
                  {fa.fields.map((f, idx) => {
                    const prefix = `${path}.${idx}` as const;
                    return (
                      <tr key={f.id}>
                        <td className="center read-only-cell">{idx + 1}</td>
                        <td>
                          <input
                            type="text"
                            className="assess-input center"
                            value={watch(`${prefix}.invoice_no`) || ""}
                            onChange={(e) => {
                              const numeric = e.target.value.replace(/\D/g, "");
                              setValue(`${prefix}.invoice_no`, numeric, { shouldDirty: true });
                            }}
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                        </td>
                        <td className="desc-col">
                          <input className="assess-input" {...register(`${prefix}.description`)} />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="assess-input num"
                            {...register(`${prefix}.quantity`, { valueAsNumber: true })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="assess-input num"
                            {...register(`${prefix}.estimated_amount`, { valueAsNumber: true })}
                          />
                        </td>
                        <td className="glass-col">
                          <input
                            type="number"
                            className="assess-input num"
                            value={watch(`${prefix}.assessed_glass`) || ""}
                            onChange={(e) =>
                              handleExclusiveSpare(path, idx, "assessed_glass", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="assess-input num"
                            value={watch(`${prefix}.assessed_plastic_rubber`) || ""}
                            onChange={(e) =>
                              handleExclusiveSpare(path, idx, "assessed_plastic_rubber", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="assess-input num"
                            value={watch(`${prefix}.assessed_others_metal`) || ""}
                            onChange={(e) =>
                              handleExclusiveSpare(path, idx, "assessed_others_metal", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input className="assess-input" {...register(`${prefix}.remarks`)} />
                        </td>
                        <td>
                          <Button variant="ghost" size="icon" onClick={() => fa.remove(idx)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-2">
              <Button size="sm" variant="outline" onClick={() => fa.append({ ...EMPTY_SPARE_ROW })}>
                <Plus className="w-4 h-4 mr-2" /> Add Row
              </Button>
            </div>
          </Card>
        ))}

        {/* Spare Totals */}
        <Card className="bg-white border-2 border-gray-300">
          <div className="section-title">TOTALS & DEPRECIATION SUMMARY (SPARES)</div>
          <table className="assess-table">
            <tbody>
              <tr>
                <td className="center" style={{ width: 240 }}>TOTAL ASSESSED</td>
                <td style={{ width: 140 }}>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.assessed_total") || 0).toFixed(2)} />
                </td>
                <td className="center" style={{ width: 160 }}>TOTAL ESTIMATED</td>
                <td style={{ width: 140 }}>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.estimated_total") || 0).toFixed(2)} />
                </td>
                <td className="center" style={{ width: 140 }}>TOTAL QTY</td>
                <td style={{ width: 140 }}>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.qty_total") || 0).toFixed(2)} />
                </td>
              </tr>

              <tr>
                <td className="center">ADD: CGST (%)</td>
                <td>
                  <input type="number" className="assess-input num"
                    {...register("assessment.spare.totals.cgst_percent", { valueAsNumber: true })} />
                </td>
                <td className="center">CGST AMOUNT</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.cgst_amount") || 0).toFixed(2)} />
                </td>
                <td className="center">GLASS TOTAL</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.assessed_glass_total") || 0).toFixed(2)} />
                </td>
              </tr>

              <tr>
                <td className="center">ADD: SGST (%)</td>
                <td>
                  <input type="number" className="assess-input num"
                    {...register("assessment.spare.totals.sgst_percent", { valueAsNumber: true })} />
                </td>
                <td className="center">SGST AMOUNT</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.sgst_amount") || 0).toFixed(2)} />
                </td>
                <td className="center">PLASTIC/RUBBER TOTAL</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.assessed_plastic_total") || 0).toFixed(2)} />
                </td>
              </tr>

              <tr className="totals-row">
                <td className="center">TOTAL WITH GST</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.total_with_gst") || 0).toFixed(2)} />
                </td>
                <td className="center">OTHERS/METAL TOTAL</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.assessed_metal_total") || 0).toFixed(2)} />
                </td>
                <td colSpan={2}></td>
              </tr>

              <tr>
                <td className="center">DEP. ON GLASS (%)</td>
                <td>
                  <input type="number" className="assess-input num"
                    {...register("assessment.spare.totals.dep_glass_percent", { valueAsNumber: true })} />
                </td>
                <td className="center">DEP. AMOUNT (GLASS)</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.dep_glass_amount") || 0).toFixed(2)} />
                </td>
                <td colSpan={2}></td>
              </tr>

              <tr>
                <td className="center">DEP. ON PLASTIC (%)</td>
                <td>
                  <input type="number" className="assess-input num"
                    {...register("assessment.spare.totals.dep_plastic_percent", { valueAsNumber: true })} />
                </td>
                <td className="center">DEP. AMOUNT (PLASTIC)</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.dep_plastic_amount") || 0).toFixed(2)} />
                </td>
                <td colSpan={2}></td>
              </tr>

              <tr>
                <td className="center">DEP. ON METAL (%)</td>
                <td>
                  <input type="number" className="assess-input num"
                    {...register("assessment.spare.totals.dep_metal_percent", { valueAsNumber: true })} />
                </td>
                <td className="center">DEP. AMOUNT (METAL)</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.dep_metal_amount") || 0).toFixed(2)} />
                </td>
                <td colSpan={2}></td>
              </tr>

              <tr className="totals-row">
                <td className="center">TOTAL DEPRECIATION</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.depreciation_total") || 0).toFixed(2)} />
                </td>
                <td className="center">NET AMOUNT</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.net_amount") || 0).toFixed(2)} />
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </Card>
      </details>

      {/* ===== Labour Section (dropdown) ===== */}
      <details open={openLabour} onToggle={(e) => setOpenLabour((e.target as HTMLDetailsElement).open)}>
        <summary>
          <div className="section-toggle">
            <div className="flex items-center">
              <span className="chev">▸</span>
              <span className="font-semibold">Labour / Repair Charges Assessment</span>
            </div>
            {savingLabour && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
          </div>
        </summary>

        {/* Labour Tables */}
        {[
          { label: "LABOUR / REPAIR CHARGES", path: "assessment.labour.main" as const, fa: labMain },
          { label: "SUPPLEMENTARY LABOUR / REPAIR", path: "assessment.labour.supplementary" as const, fa: labSup },
        ].map(({ label, path, fa }) => (
          <Card key={label} className="bg-white border-2 border-gray-300">
            <div className="section-title">{label}</div>
            <div className="scroll-area">
              <table className="assess-table">
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>Sl.</th>
                    <th style={{ width: 90 }}>Invoice No.</th>
                    <th className="desc-col">Detail of Labour / Repair Charges</th>
                    <th style={{ width: 120 }}>Estimated Amount</th>
                    <th style={{ width: 120 }}>Assessed Amount</th>
                    <th style={{ width: 260 }}>Detail of Damages / Extent of Repairs Done</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {fa.fields.map((f, idx) => {
                    const prefix = `${path}.${idx}` as const;
                    return (
                      <tr key={f.id}>
                        <td className="center read-only-cell">{idx + 1}</td>
                        <td>
                          <input
                            type="text"
                            className="assess-input center"
                            value={watch(`${prefix}.invoice_no`) || ""}
                            onChange={(e) => {
                              const numeric = e.target.value.replace(/\D/g, "");
                              setValue(`${prefix}.invoice_no`, numeric, { shouldDirty: true });
                            }}
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                        </td>
                        <td className="desc-col">
                          <input className="assess-input" {...register(`${prefix}.description`)} />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="assess-input num"
                            {...register(`${prefix}.estimated_amount`, { valueAsNumber: true })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="assess-input num"
                            {...register(`${prefix}.assessed_amount`, { valueAsNumber: true })}
                          />
                        </td>
                        <td>
                          <input className="assess-input" {...register(`${prefix}.remarks`)} />
                        </td>
                        <td>
                          <Button variant="ghost" size="icon" onClick={() => fa.remove(idx)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-2">
              <Button size="sm" variant="outline" onClick={() => fa.append({ ...EMPTY_LABOUR_ROW })}>
                <Plus className="w-4 h-4 mr-2" /> Add Row
              </Button>
            </div>
          </Card>
        ))}

        {/* Labour Totals */}
        <Card className="bg-white border-2 border-gray-300">
          <div className="section-title">TOTALS & DEDUCTION SUMMARY (LABOUR)</div>
          <table className="assess-table">
            <tbody>
              <tr>
                <td className="center" style={{ width: 240 }}>TOTAL ESTIMATED</td>
                <td style={{ width: 140 }}>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.labour.totals.estimated_total") || 0).toFixed(2)} />
                </td>
                <td className="center" style={{ width: 160 }}>TOTAL ASSESSED</td>
                <td style={{ width: 140 }}>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.labour.totals.assessed_total") || 0).toFixed(2)} />
                </td>
                <td colSpan={2}></td>
              </tr>

              <tr>
                <td className="center">ADD: CGST (%)</td>
                <td>
                  <input type="number" className="assess-input num"
                    {...register("assessment.labour.totals.cgst_percent", { valueAsNumber: true })} />
                </td>
                <td className="center">CGST AMOUNT</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.labour.totals.cgst_amount") || 0).toFixed(2)} />
                </td>
                <td colSpan={2}></td>
              </tr>

              <tr>
                <td className="center">ADD: SGST (%)</td>
                <td>
                  <input type="number" className="assess-input num"
                    {...register("assessment.labour.totals.sgst_percent", { valueAsNumber: true })} />
                </td>
                <td className="center">SGST AMOUNT</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.labour.totals.sgst_amount") || 0).toFixed(2)} />
                </td>
                <td colSpan={2}></td>
              </tr>

              <tr className="totals-row">
                <td className="center">TOTAL WITH GST</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.labour.totals.total_with_gst") || 0).toFixed(2)} />
                </td>
                <td colSpan={4}></td>
              </tr>

              <tr>
                <td className="center">LESS: IMT DEDUCTION (%)</td>
                <td>
                  <input type="number" className="assess-input num"
                    {...register("assessment.labour.totals.imt_percent", { valueAsNumber: true })} />
                </td>
                <td className="center">IMT DEDUCTION AMOUNT</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.labour.totals.imt_deduction") || 0).toFixed(2)} />
                </td>
                <td colSpan={2}></td>
              </tr>

              <tr className="totals-row">
                <td className="center">FINAL TOTAL</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.labour.totals.final_total") || 0).toFixed(2)} />
                </td>
                <td colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </Card>
      </details>

      {/* ===== SUMMARY OF ASSESSMENT (auto, read-only; salvage & policy excess editable) ===== */}
      <details open={openSummary} onToggle={(e) => setOpenSummary((e.target as HTMLDetailsElement).open)}>
        <summary>
          <div className="section-toggle">
            <div className="flex items-center">
              <span className="chev">▸</span>
              <span className="font-semibold">Summary of Assessment</span>
            </div>
            {savingSummary && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
          </div>
        </summary>

        <Card className="bg-white border-2 border-gray-300">
          <div className="section-title">SUMMARY OF ASSESSMENT</div>
          <table className="assess-table">
            <thead>
              <tr>
                <th colSpan={2}></th>
                <th style={{ width: 140 }}>ESTIMATED</th>
                <th style={{ width: 140 }}>ASSESSED</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={2}><strong>TOTAL AMOUNT ON SPARE PARTS</strong></td>
                <td className="read-only-cell"></td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.summary.total_spare_assessed") || 0).toFixed(2)} />
                </td>
              </tr>
              <tr>
                <td colSpan={2}><strong>LABOUR CHARGES</strong></td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.labour.totals.estimated_total") || 0).toFixed(2)} />
                </td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.summary.total_labour_assessed") || 0).toFixed(2)} />
                </td>
              </tr>
              <tr className="totals-row">
                <td colSpan={2}><strong>ESTIMATED / GROSS ASSESSED LOSS AMOUNT</strong></td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.summary.gross_estimated") || 0).toFixed(2)} />
                </td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.summary.gross_assessed") || 0).toFixed(2)} />
                </td>
              </tr>

              <tr>
                <td><strong>LESS: DEPRECIATION ON GLASS PARTS</strong></td>
                <td className="center">@</td>
                <td className="read-only-cell"></td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.summary.dep_glass_amount") || 0).toFixed(2)} />
                </td>
              </tr>
              <tr>
                <td>
                  <div><strong>LESS: DEPRECIATION ON RUBBER / PLASTIC PARTS</strong></div>
                  <div style={{ fontSize: 11 }}>(Including Spare parts covered under IMT-23)</div>
                  <div style={{ fontSize: 11 }}>Total Assessed Amount on Rubber / Plastic Parts</div>
                </td>
                <td className="center">@</td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.spare.totals.assessed_plastic_total") || 0).toFixed(2)} />
                </td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.summary.dep_plastic_amount") || 0).toFixed(2)} />
                </td>
              </tr>
              <tr>
                <td>
                  <div><strong>LESS: DEPRECIATION ON METAL / OTHER PARTS</strong></div>
                  <div style={{ fontSize: 11 }}>(Including Spare parts covered under IMT-23)</div>
                </td>
                <td className="center">@</td>
                <td className="read-only-cell"></td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.summary.dep_metal_amount") || 0).toFixed(2)} />
                </td>
              </tr>

              <tr>
                <td><strong>LESS: DEDUCTION ON 50% IMT-23 LABOUR/PAINTING</strong></td>
                <td></td>
                <td className="read-only-cell"></td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.summary.imt_labour_deduction") || 0).toFixed(2)} />
                </td>
              </tr>

              <tr className="totals-row">
                <td colSpan={2}><strong>ASSESSED LOSS AMOUNT NET OF DEPN. & IMT-23 DEDUCTION</strong></td>
                <td className="read-only-cell"></td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.summary.net_after_dep_imt") || 0).toFixed(2)} />
                </td>
              </tr>

              <tr>
                <td><strong>LESS: SALVAGE VALUE & R.O</strong></td>
                <td></td>
                <td className="read-only-cell"></td>
                <td>
                  <input
                    type="number"
                    className="assess-input num"
                    {...register("assessment.summary.salvage_value", { valueAsNumber: true })}
                  />
                </td>
              </tr>
              <tr>
                <td><strong>LESS: POLICY EXCESS</strong></td>
                <td></td>
                <td className="read-only-cell"></td>
                <td>
                  <input
                    type="number"
                    className="assess-input num"
                    {...register("assessment.summary.policy_excess", { valueAsNumber: true })}
                  />
                </td>
              </tr>

              <tr className="totals-row">
                <td colSpan={2}><strong>NET ASSESSED LOSS AMOUNT / LIABILITY</strong></td>
                <td className="read-only-cell"></td>
                <td>
                  <input className="assess-input num read-only-cell" readOnly
                    value={r2(watch("assessment.summary.final_net_liability") || 0).toFixed(2)} />
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </details>
    </div>
  );
};

export default Assessment;
