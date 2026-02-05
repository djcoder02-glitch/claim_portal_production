import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUpdateClaimSilent, type Claim } from "@/hooks/useClaims";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { format } from "date-fns";

// Number to words converter
const numberToWords = (num: number): string => {
  if (num === 0) return "Zero";
  
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  
  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return "";
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertLessThanThousand(n % 100) : "");
  };
  
  const convertIndianNumbering = (n: number): string => {
    if (n === 0) return "Zero";
    
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const remainder = n % 1000;
    
    let result = "";
    if (crore > 0) result += convertLessThanThousand(crore) + " Crore ";
    if (lakh > 0) result += convertLessThanThousand(lakh) + " Lakh ";
    if (thousand > 0) result += convertLessThanThousand(thousand) + " Thousand ";
    if (remainder > 0) result += convertLessThanThousand(remainder);
    
    return result.trim();
  };
  
  return convertIndianNumbering(Math.floor(num));
};


interface FeeBillFormProps {
  claim: Claim;
}

// ==================== CONFIGURATION SECTION ====================
// This is where you configure all fields, labels, and text
// Easy to modify without touching the JSX below!

// API Configuration
const API_BASE = "https://mlkkk63swrqairyiahlk357sui0argkn.lambda-url.ap-south-1.on.aws";

// Fixed text configuration
const FIXED_TEXT = {
  pageTitle: "Fee Bill Details",
  invoiceHeader: "SURVEY FEE INVOICE",
  companyAddress: "UNITED INDIA INSURANCE CO. LTD., D.O. Tatibandh,\nRaipur",
  nonGstBadge: "NON-GST INVOICE",
  bankDetailsLabel: "BANK DETAILS FOR RTGS",
  bankName: "ICICI BANK LTD., Nehru Nagar (East), Bhilai-490020 (C.G.)",
  accountNumber: "001605050333",
  ifscCode: "ICIC0000186",
  feeTableNote: "** All the below amounts are in Indian Rupees **",
  signatureName: "RAJESH",
  advanceReceiptHeader: "ADVANCE RECEIPT",
};

// Policy information fields configuration (READ-ONLY - auto-populated)
const POLICY_INFO_FIELDS = [
  { 
    key: 'insured_name',
    label: 'THE INSURED',
    type: 'readonly' as const,
    source: 'form_data.insured_name'
  },
  { 
    key: 'insurer_name',
    label: 'THE INSURERS',
    type: 'readonly' as const,
    source: 'form_data.insurer'
  },
  { 
    key: 'policy_number',
    label: 'INSURANCE POLICY NUMBER',
    type: 'readonly' as const,
    source: 'form_data.policy_number'
  },
  { 
    key: 'policy_type',
    label: 'INSURANCE POLICY TYPE',
    type: 'readonly' as const,
    source: 'policy_types.name'
  },
  { 
    key: 'insured_property',
    label: 'INSURED PROPERTY',
    type: 'readonly' as const,
    source: 'form_data.insured_property'
  },
  { 
    key: 'survey_type',
    label: 'TYPE OF SURVEY',
    type: 'readonly' as const,
    source: 'form_data.survey_type',
    defaultValue: 'Commercial Vehicle Final Survey'
  },
];

// Editable fields that appear after policy info (EDITABLE)
const EDITABLE_POLICY_FIELDS = [
  { 
    key: 'estimated_loss_amount',
    label: 'ESTIMATED LOSS AMOUNT',
    type: 'editable_currency' as const,
    defaultValue: 0,
    prefix: '₹ ',
    conditionalText: (value: number) => value > 200000 ? '(More than 2 Lakhs)' : ''
  },
  { 
    key: 'insured_declared_value',
    label: "INSURED'S DECLARED VALUE ON I V",
    type: 'editable_currency' as const,
    defaultValue: 0,
    prefix: '₹ ',
    conditionalText: (value: number, compareValue?: number) => 
      compareValue && value > compareValue ? '(More than estimate amt.)' : ''
  },
];

// Fee breakdown fields configuration
const FEE_BREAKDOWN_FIELDS = [
  {
    section: 'Final Survey',
    rows: [
      {
        key: 'final_survey_base',
        label: 'Base Fee',
        type: 'editable' as const,
        defaultValue: 2800.00,
      },
      {
        key: 'final_survey_additional',
        label: 'Addl. Fee @ 0.70%',
        type: 'calculated' as const,
        calculation: (values: any) => (Number(values.final_survey_base) || 0) * 0.007,
      },
    ],
  },
  {
    section: 'Reinspection',
    rows: [
      {
        key: 'reinspection_fee',
        label: '',
        type: 'editable' as const,
        defaultValue: 1000.00,
      },
    ],
  },
  {
    section: 'LOCAL CONVEYANCE ALLOWANCE',
    rows: [
      {
        key: 'local_conveyance_amount',
        label: 'Visits Billed',
        type: 'editable' as const,
        defaultValue: 1500.00,
        additionalInput: {
          key: 'local_conveyance_visits',
          defaultValue: 3,
          type: 'number' as const,
        },
      },
    ],
  },
  {
    section: 'TRAVELLING EXPENSES',
    rows: [
      {
        key: 'travelling_amount',
        label: 'Total Kms run',
        type: 'calculated' as const,
        calculation: (values: any) => 
          (Number(values.travelling_km) || 0) * (Number(values.travelling_rate) || 0),
        additionalInputs: [
          { key: 'travelling_km', defaultValue: 0, label: 'Kms' },
          { key: 'travelling_rate', defaultValue: 15.307, label: '@ ₹', suffix: '/km' },
        ],
      },
    ],
  },
  {
    section: 'OTHER EXPENSES',
    rows: [
      {
        key: 'other_expenses',
        label: '',
        type: 'editable' as const,
        defaultValue: 0,
      },
    ],
  },
  {
    section: 'PHOTOGRAPH CHARGES',
    rows: [
      {
        key: 'photography_amount',
        label: 'Final Survey & Reinspection',
        type: 'calculated' as const,
        calculation: (values: any) => 
          (Number(values.photography_survey_count) || 0) * (Number(values.photography_per_photo) || 0),
        additionalInputs: [
          { key: 'photography_survey_count', defaultValue: 1, label: 'Total Photographs #', suffix: 'Nos.' },
          { key: 'photography_per_photo', defaultValue: 10, label: '@ ₹', suffix: 'per photograph' },
        ],
      },
    ],
  },
];

// ==================== END CONFIGURATION SECTION ====================

export const FeeBillForm = ({ claim }: FeeBillFormProps) => {
  const [autoSaving, setAutoSaving] = useState(false);
  const updateClaimMutation = useUpdateClaimSilent();
  
  // Build default values from configuration
  const buildDefaultValues = () => {
    const defaults: any = {
      invoice_number: claim.claim_number || "",
      invoice_date: claim.form_data?.invoice_date || format(new Date(), 'yyyy-MM-dd'),
      bank_name: FIXED_TEXT.bankName,
      account_number: FIXED_TEXT.accountNumber,
      ifsc_code: FIXED_TEXT.ifscCode,
    };

    // Add read-only policy info fields
    POLICY_INFO_FIELDS.forEach(field => {
      const path = field.source.split('.');
      let value: any = claim;
      for (const key of path) {
        value = value?.[key];
      }
      defaults[field.key] = value || field.defaultValue || "";
    });

    // Add editable policy fields
    EDITABLE_POLICY_FIELDS.forEach(field => {
      defaults[field.key] = claim.form_data?.[field.key] || field.defaultValue || 0;
    });

    // Add fee breakdown fields
    FEE_BREAKDOWN_FIELDS.forEach(section => {
      section.rows.forEach(row => {
        defaults[row.key] = claim.form_data?.[row.key] || row.defaultValue || 0;
        
        // Add additional inputs
        if (row.additionalInput) {
          defaults[row.additionalInput.key] = 
            claim.form_data?.[row.additionalInput.key] || row.additionalInput.defaultValue;
        }
        if (row.additionalInputs) {
          row.additionalInputs.forEach(input => {
            defaults[input.key] = claim.form_data?.[input.key] || input.defaultValue;
          });
        }
      });
    });

    // Add totals
    defaults.total_above = claim.form_data?.total_above || 0;
    defaults.gst_amount = claim.form_data?.gst_amount || 0;
    defaults.total_amount = claim.form_data?.total_amount || 0;

    return defaults;
  };

  const { register, watch, setValue, getValues } = useForm({
    defaultValues: buildDefaultValues()
  });

  // Auto-calculation logic
  useEffect(() => {
    let autoSaveTimer: NodeJS.Timeout | null = null;
    
    const subscription = watch((values) => {
      let total = 0;

      // Calculate all fee breakdown fields
      FEE_BREAKDOWN_FIELDS.forEach(section => {
        section.rows.forEach(row => {
          if (row.type === 'calculated' && row.calculation) {
            const calculatedValue = row.calculation(values);
            const formattedValue = Number(Number(calculatedValue).toFixed(2));
            const currentValue = values[row.key];
            
            // Only update if value actually changed
            if (currentValue !== formattedValue) {
              setValue(row.key, formattedValue, { shouldValidate: false, shouldDirty: false });
            }
            total += calculatedValue;
          } else if (row.type === 'editable') {
            total += Number(values[row.key]) || 0;
          }
        });
      });

      const totalAbove = Number(total.toFixed(2));
      const totalAmount = Number(total.toFixed(2));
      
      // Only update if values changed
      if (values.total_above !== totalAbove) {
        setValue('total_above', totalAbove, { shouldValidate: false, shouldDirty: false });
      }
      if (values.gst_amount !== 0) {
        setValue('gst_amount', 0, { shouldValidate: false, shouldDirty: false });
      }
      if (values.total_amount !== totalAmount) {
        setValue('total_amount', totalAmount, { shouldValidate: false, shouldDirty: false });
      }
      
      // Auto-save after 1 second
      setAutoSaving(true);
      
      // Clear existing timer
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
      
      autoSaveTimer = setTimeout(() => {
        saveData(getValues());
      }, 1000);
    });
    
    // Cleanup function
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
      subscription.unsubscribe();
    };
  }, [watch, setValue, getValues]);

  const saveData = async (data: any) => {
    try {
      await updateClaimMutation.mutateAsync({
        id: claim.id,
        updates: {
          form_data: {
            ...claim.form_data,
            ...data
          }
        }
      });
      setAutoSaving(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setAutoSaving(false);
    }
  };

  const handleManualSave = async () => {
    await saveData(getValues());
    toast.success("Fee bill details saved!");
  };

  const handlePrintFeeBill = async () => {
    const values = getValues();
    
    // Build JSON payload for Lambda
    const payload = {
      company: values.insurer_name || "Insurance Company",
      reportName: `Fee Bill - ${values.invoice_number}`,
      assets: {
        firstPageBackground: "https://ik.imagekit.io/pritvik/Reports%20-%20generic%20bg.png?updatedAt=1763381793043",
        otherPagesBackground: "https://ik.imagekit.io/pritvik/Reports%20-%20generic%20footer%20only%20bg",
      },
      components: [
        {
          type: "header",
          style: { wrapper: "px-0 py-2", title: "text-3xl font-extrabold tracking-wide text-black center" },
          props: { text: FIXED_TEXT.invoiceHeader },
        },
        {
          type: "table",
          props: {
            headers: ["Field", "Value"],
            rows: [
              ["Invoice No.", values.invoice_number],
              ["Date", (() => {
                try {
                  const date = new Date(values.invoice_date);
                  return isNaN(date.getTime()) ? format(new Date(), "MMM dd, yyyy") : format(date, "MMM dd, yyyy");
                } catch {
                  return format(new Date(), "MMM dd, yyyy");
                }
              })()],
              ["Company", FIXED_TEXT.companyAddress],
            ],
          },
        },
        { type: "subheader", props: { text: FIXED_TEXT.bankDetailsLabel } },
        {
          type: "para",
          props: { text: `${FIXED_TEXT.bankName} | A/C No.- ${FIXED_TEXT.accountNumber} | IFSC: ${FIXED_TEXT.ifscCode}` },
        },
        { type: "subheader", props: { text: "Policy Information" } },
        {
          type: "table",
          props: {
            headers: ["Field", "Value"],
            rows: [
              ...POLICY_INFO_FIELDS.map(f => [f.label, values[f.key] || "-"]),
              ...EDITABLE_POLICY_FIELDS.map(f => [f.label, `₹ ${Number(values[f.key]).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]),
            ],
          },
        },
        { type: "subheader", props: { text: "Professional Fee Breakdown" } },
        {
          type: "table",
          props: {
            headers: ["Section", "Description", "Amount (₹)"],
            rows: FEE_BREAKDOWN_FIELDS.flatMap(section =>
              section.rows.map(row => [
                section.section,
                row.label || "",
                Number(values[row.key]).toFixed(2),
              ])
            ),
          },
        },
        {
          type: "table",
          props: {
            headers: ["", "Amount (₹)"],
            rows: [
              ["TOTAL OF ABOVE", Number(values.total_above).toFixed(2)],
              ["ADD: GST (NOT LIABLE TO PAY)", "0.00"],
              ["TOTAL AMOUNT", Number(values.total_amount).toFixed(2)],
            ],
          },
        },
        { type: "subheader", props: { text: FIXED_TEXT.advanceReceiptHeader } },
        {
          type: "para",
          props: { 
            text: `Received with thanks from 'United India Insurance Co. Ltd.' a sum of ${numberToWords(Number(values.total_amount))} Only towards above survey-bill.\n\n${FIXED_TEXT.signatureName}` 
          },
        },
      ],
    };

    try {
      const res = await fetch(`${API_BASE}/render.pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("PDF API error:", err);
        toast.error("Failed to generate fee bill PDF");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.success("Fee bill PDF opened in new tab");
    } catch (error) {
      console.error("Print fee bill error:", error);
      toast.error("Failed to print fee bill");
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        .excel-table {
          border-collapse: collapse;
          width: 100%;
          border: 2px solid #000;
          background: white;
        }
        .excel-table td, .excel-table th {
          border: 1px solid #000;
          padding: 8px 12px;
          font-size: 14px;
        }
        .excel-table th {
          background-color: #e8e8e8;
          font-weight: 600;
          text-align: left;
        }
        .excel-table input, .excel-table textarea {
          border: none;
          background: transparent;
          width: 100%;
          padding: 4px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
        }
        .excel-table input:focus, .excel-table textarea:focus {
          outline: 2px solid #4a90e2;
          outline-offset: -2px;
          background: #fff;
        }
        .label-cell {
          background-color: #f5f5f5;
          font-weight: 500;
          vertical-align: middle;
          white-space: nowrap;
        }
        .value-cell {
          background-color: white;
          vertical-align: middle;
        }
        .merged-header {
          background-color: #d9d9d9;
          font-weight: bold;
          text-align: center;
          font-size: 16px;
          padding: 12px;
          border: 2px solid #000;
        }
        .total-row {
          background-color: #fff2cc;
          font-weight: bold;
          border-top: 2px solid #000;
        }
        .final-total-row {
          background-color: #c6efce;
          font-weight: bold;
          font-size: 16px;
          border: 2px solid #000;
        }
        .colon-separator {
          width: 20px;
          text-align: center;
          background-color: #f5f5f5;
        }
        .number-cell {
          text-align: right;
          font-family: 'Courier New', monospace;
        }
        .read-only-cell {
          background-color: #f1f5f9;
          cursor: not-allowed;
        }
      `}</style>

      {/* Save Controls */}
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-3xl font-bold text-gray-800">{FIXED_TEXT.pageTitle}</h2>
        <div className="flex items-center gap-3">
          {autoSaving && (
            <span className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Auto-saving...
            </span>
          )}
          <Button onClick={handleManualSave} size="sm" className="bg-slate-700 hover:bg-slate-800">
            <Save className="w-4 h-4 mr-2" />
            Save Manually
          </Button>
        </div>
      </div>

      {/* Main Invoice Table - Everything Combined */}
      <Card className="bg-white overflow-hidden border-2 border-gray-300">
        <div className="merged-header">{FIXED_TEXT.invoiceHeader}</div>
        <table className="excel-table">
          <tbody>
            {/* Invoice Number and Date Row */}
            <tr>
              <td className="label-cell" style={{ width: '25%' }}>INVOICE NO.</td>
              <td className="colon-separator">:</td>
              <td className="value-cell" style={{ width: '25%' }}>
                <input {...register("invoice_number")} readOnly className="read-only-cell" />
              </td>
              <td className="label-cell" style={{ width: '25%' }}>DATE</td>
              <td className="colon-separator">:</td>
              <td className="value-cell" style={{ width: '25%' }}>
                <input {...register("invoice_date")} type="date" />
              </td>
            </tr>

            {/* Company Address Row */}
            <tr>
              <td colSpan={3} className="value-cell" style={{ padding: '12px', fontWeight: '500', whiteSpace: 'pre-line' }}>
                {FIXED_TEXT.companyAddress}
              </td>
              <td colSpan={3} className="value-cell" style={{ textAlign: 'center', backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                {FIXED_TEXT.nonGstBadge}
              </td>
            </tr>

            {/* Bank Details Header Row */}
            <tr>
              <td className="label-cell" style={{ fontWeight: 'bold' }}>{FIXED_TEXT.bankDetailsLabel}</td>
              <td colSpan={5} className="value-cell" style={{ padding: '8px' }}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{FIXED_TEXT.bankName}</span>
                  <span className="font-medium">A/C No.- {FIXED_TEXT.accountNumber}</span>
                  <span className="font-medium">IFSC Code: {FIXED_TEXT.ifscCode}</span>
                </div>
              </td>
            </tr>

            {/* Policy Information Fields - Generated from Config (READ-ONLY) */}
            {POLICY_INFO_FIELDS.map((field) => (
              <tr key={field.key}>
                <td className="label-cell">{field.label}</td>
                <td className="colon-separator">:</td>
                <td className="value-cell" colSpan={4}>
                  {watch(field.key) || ''}
                </td>
              </tr>
            ))}

            {/* Editable Policy Fields (EDITABLE) */}
            {EDITABLE_POLICY_FIELDS.map((field) => (
              <tr key={field.key}>
                <td className="label-cell">{field.label}</td>
                <td className="colon-separator">:</td>
                <td className="value-cell" colSpan={4}>
                  <div className="flex items-center gap-2">
                    {field.prefix && <span>{field.prefix}</span>}
                    <input 
                      {...register(field.key, { valueAsNumber: true })} 
                      type="number" 
                      step="0.01"
                      className="flex-1"
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value)) {
                          setValue(field.key, Number(value.toFixed(2)));
                        }
                      }}
                    />
                    {field.conditionalText && (
                      <span className="text-sm text-gray-600">
                        {field.conditionalText(
                          Number(watch(field.key)),
                          field.key === 'insured_declared_value' ? Number(watch('estimated_loss_amount')) : undefined
                        )}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Professional Fee Breakdown */}
      <Card className="bg-white overflow-hidden border-2 border-gray-300">
        <div className="p-4 text-center text-sm italic">
          {FIXED_TEXT.feeTableNote}
        </div>
        <table className="excel-table">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>PROFESSIONAL FEE</th>
              <th style={{ width: '40%' }}></th>
              <th style={{ width: '30%', textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {/* Fee Breakdown - Generated from Config */}
            {FEE_BREAKDOWN_FIELDS.map((section, sectionIdx) => (
              section.rows.map((row, rowIdx) => (
                <tr key={`${sectionIdx}-${rowIdx}`}>
                  {rowIdx === 0 && (
                    <td 
                      className="label-cell" 
                      rowSpan={section.rows.length} 
                      style={{ verticalAlign: 'middle' }}
                    >
                      {section.section}
                    </td>
                  )}
                  <td className="value-cell">
                    {row.label}
                    {row.additionalInput && (
                      <>
                        {' '}
                        <input 
                          {...register(row.additionalInput.key, { valueAsNumber: true })} 
                          type="number" 
                          style={{ width: '50px', display: 'inline-block', textAlign: 'center' }} 
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                              setValue(row.additionalInput!.key, Number(value.toFixed(2)));
                            }
                          }}
                        />
                        {' '}{row.label}
                      </>
                    )}
                    {row.additionalInputs && (
                      <div className="inline-flex items-center gap-2">
                        {row.additionalInputs.map((input, idx) => (
                          <span key={idx}>
                            {input.label}{' '}
                            <input 
                              {...register(input.key, { valueAsNumber: true })} 
                              type="number" 
                              step={input.key.includes('rate') ? '0.001' : '0.01'}
                              style={{ width: input.key.includes('rate') ? '80px' : '60px', display: 'inline-block', textAlign: 'center' }} 
                              onBlur={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value)) {
                                  const decimals = input.key.includes('rate') ? 3 : 2;
                                  setValue(input.key, Number(value.toFixed(decimals)));
                                }
                              }}
                            />
                            {input.suffix && ` ${input.suffix}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={`value-cell number-cell ${row.type === 'calculated' ? 'read-only-cell' : ''}`}>
                    {row.type === 'calculated' ? (
                      <input 
                        value={watch(row.key)?.toFixed(2) || '0.00'} 
                        readOnly 
                        className="number-cell read-only-cell" 
                      />
                    ) : (
                      <input 
                        {...register(row.key, { valueAsNumber: true })} 
                        type="number" 
                        step="0.01" 
                        className="number-cell"
                        onBlur={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            setValue(row.key, Number(value.toFixed(2)));
                          }
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))
            ))}

            {/* Totals */}
            <tr className="total-row">
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: '20px', fontWeight: 'bold' }}>TOTAL OF ABOVE</td>
              <td className="number-cell" style={{ fontWeight: 'bold', fontSize: '16px' }}>
                ₹ {watch('total_above')?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
              </td>
            </tr>

            {/* GST */}
            <tr>
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: '20px' }}>
                <strong>ADD: GST (NOT LIABLE TO PAY)</strong> &lt; 0% &gt;
              </td>
              <td className="number-cell">0.00</td>
            </tr>

            {/* Final Total */}
            <tr className="final-total-row">
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: '20px', fontWeight: 'bold', fontSize: '18px' }}>TOTAL AMOUNT</td>
              <td className="number-cell" style={{ fontWeight: 'bold', fontSize: '18px' }}>
                ₹ {watch('total_amount')?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* Advance Receipt */}
      <Card className="bg-white overflow-hidden border-2 border-gray-300">
        <div className="merged-header">{FIXED_TEXT.advanceReceiptHeader}</div>
        <table className="excel-table">
          <tbody>
            <tr>
              <td style={{ padding: '20px' }}>
                Received with thanks from <b>'United India Insurance Co. Ltd.'</b> a sum of{' '}
                <strong>{numberToWords(Number(watch('total_amount')) || 0)} Only</strong>
                {' '}towards above survey-bill.
              </td>
            </tr>
            <tr>
              <td style={{ padding: '40px 20px 20px 20px' }}>
                <div style={{ textAlign: 'right', marginRight: '40px' }}>
                  <div style={{ borderTop: '2px solid #000', width: '200px', display: 'inline-block', textAlign: 'center', paddingTop: '10px' }}>
                    <strong>{FIXED_TEXT.signatureName}</strong>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* Print Fee Bill Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handlePrintFeeBill}
          className="bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          Print Fee Bill
        </Button>
      </div>
    </div>
  );
};