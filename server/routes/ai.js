import { GoogleGenAI } from '@google/genai';
import { first, all, json } from '../utils/d1.js';

let kenyanMedicinesCache = null;
async function loadKnowledgeBase() {
  if (kenyanMedicinesCache) return kenyanMedicinesCache;
  try {
    const mod = await import('../data/kenyan-medicines.js');
    kenyanMedicinesCache = mod.kenyanMedicines || [];
  } catch {
    kenyanMedicinesCache = [];
  }
  return kenyanMedicinesCache;
}

async function findMedicineInfo(name) {
  const medicines = await loadKnowledgeBase();
  const lowerName = name.toLowerCase();
  return medicines.filter(
    (med) =>
      (med.brand_name && med.brand_name.toLowerCase().includes(lowerName)) ||
      (med.generic_name && med.generic_name.toLowerCase().includes(lowerName)) ||
      (med.category && med.category.toLowerCase().includes(lowerName))
  );
}

function getAiClient() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      return new GoogleGenAI({ apiKey });
    }
    return new GoogleGenAI();
  } catch (err) {
    console.warn('Gemini client initialization warning:', err.message);
    return null;
  }
}

export async function aiRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';

  // 1. CHAT ENDPOINT (Gemini AI + Fallback)
  if (method === 'POST' && segment === 'chat') {
    const body = await request.json().catch(() => ({}));
    const { message, history } = body;

    if (!message) {
      return json({ error: 'Message is required' }, 400);
    }

    try {
      const ai = getAiClient();
      if (ai) {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: message,
          config: {
            systemInstruction: `You are Hauzral Clinical AI, an expert clinical pharmacy advisor for a licensed healthcare dispensary and retail pharmacy POS system.
You assist pharmacists, pharmacy technicians, cashiers, and medical practitioners with:
1. Drug-drug interactions and adverse event prevention.
2. Dosage recommendations for pediatric, geriatric, and adult patients.
3. Kenyan and international clinical protocols, Pharmacy and Poisons Board (PPB) guidelines, and standard treatment guidelines.
4. Patient counseling notes (administration timing, food interactions, common side effects).
5. Fast POS operations, FEFO stock advice, and alternative generic brand substitutions.

Keep answers concise, medically accurate, and organized with clear bullet points. When relevant, highlight caution banners with ⚠️ Warning or ℹ️ Tip.`,
          },
        });

        if (response && response.text) {
          return json({
            response: response.text,
            type: 'ai_clinical',
            source: 'gemini-2.5-flash',
          });
        }
      }
    } catch (aiErr) {
      console.warn('Gemini generateContent error, falling back to local clinical knowledge base:', aiErr.message);
    }

    // Local fallback for offline/unconfigured environments
    const lowerMsg = message.toLowerCase();
    let responseText = '';
    let responseType = 'general';

    if (lowerMsg.includes('stock') || lowerMsg.includes('inventory')) {
      responseText = `**Stock & Inventory Optimization Advice:**\n\n- **FEFO Discipline:** Always dispense batches with earliest expiry first to minimize expired stock write-offs.\n- **Buffer Stock:** Maintain at least 14 days of average daily sales on fast-movers like Paracetamol, Amoxicillin, and Metformin.\n- **Reorder Frequency:** Set automated low-stock notifications at 15–20 units for oral tablets and 10 units for injectables/syrups.`;
      responseType = 'inventory';
    } else if (lowerMsg.includes('interaction') || lowerMsg.includes('contraindication')) {
      responseText = `**Clinical Drug Interaction Rules:**\n\n- **NSAIDs + Anticoagulants (e.g. Diclofenac + Warfarin):** High gastrointestinal bleeding risk. Avoid combination or co-prescribe PPI.\n- **ACE Inhibitors + Potassium-Sparing Diuretics:** Risk of severe hyperkalemia; monitor serum electrolytes.\n- **Metronidazole + Alcohol:** Severe disulfiram-like reaction (nausea, tachycardia); advise patient to avoid alcohol during and 48 hours post-treatment.`;
      responseType = 'interactions';
    } else if (lowerMsg.includes('paracetamol') || lowerMsg.includes('panadol')) {
      responseText = `**Paracetamol (Acetaminophen) Clinical Summary:**\n\n- **Adult Dosage:** 500mg–1000mg every 4–6 hours as needed; max 4000mg/24h.\n- **Pediatric Dosage:** 10–15mg/kg every 4–6 hours; max 60mg/kg/day.\n- **Hepatic Caution:** Reduce dose or avoid in severe hepatic impairment or chronic alcoholism.\n- **Available Kenyan Brands:** Panadol, Paracetamol Cosmos, Emzor, Medopharm.`;
      responseType = 'drug_info';
    } else {
      responseText = `**Hauzral Clinical Assistant:**\n\nI can help you review:\n- Real-time drug-drug interactions and dosage verification\n- Generic substitutions for out-of-stock brands\n- Patient counseling instructions & precautions\n- Pharmacy Poisons Board (PPB) compliance & scheduled drug logging\n- Inventory reordering recommendations`;
    }

    return json({
      response: responseText,
      type: responseType,
      source: 'clinical_knowledge_base',
    });
  }

  // 2. REAL-TIME DRUG INTERACTION CHECKER FOR POS CART
  if (method === 'POST' && (segment === 'interactions' || segment === 'check-interactions')) {
    const body = await request.json().catch(() => ({}));
    const { medicines } = body; // Array of medicine names or objects

    if (!medicines || !Array.isArray(medicines) || medicines.length < 2) {
      return json({ has_interactions: false, interactions: [] });
    }

    const drugNames = medicines.map((m) => (typeof m === 'string' ? m : m.brand_name || m.generic_name || '')).filter(Boolean);

    try {
      const ai = getAiClient();
      if (ai) {
        const prompt = `Assess these medications being purchased together in a pharmacy: ${drugNames.join(', ')}.
Identify any moderate or severe drug-drug interactions, contraindications, or duplicate therapy.
Respond in valid JSON format ONLY with this schema:
{
  "has_interactions": true or false,
  "summary": "short summary sentence",
  "alerts": [
    {
      "severity": "severe" | "moderate" | "minor",
      "drugs": ["Drug A", "Drug B"],
      "description": "clinical rationale",
      "recommendation": "what the pharmacist should advise or check"
    }
  ]
}`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          return json(parsed);
        }
      }
    } catch (err) {
      console.warn('AI interaction check fallback:', err.message);
    }

    // Heuristic interaction checks
    const lowerDrugs = drugNames.map((d) => d.toLowerCase());
    const alerts = [];

    const hasNSAID = lowerDrugs.some((d) => d.includes('diclofenac') || d.includes('ibuprofen') || d.includes('aspirin') || d.includes('naproxen'));
    const hasAnticoagulant = lowerDrugs.some((d) => d.includes('warfarin') || d.includes('heparin') || d.includes('rivaroxaban') || d.includes('aspirin'));
    const hasDuplicatePain = lowerDrugs.filter((d) => d.includes('diclofenac') || d.includes('ibuprofen') || d.includes('naproxen')).length > 1;

    if (hasNSAID && hasAnticoagulant && lowerDrugs.includes('warfarin')) {
      alerts.push({
        severity: 'severe',
        drugs: ['NSAID', 'Warfarin'],
        description: 'Concomitant use significantly increases gastric mucosal damage and major gastrointestinal bleeding risk.',
        recommendation: 'Consult prescribing physician. Substitute with Paracetamol if analgesic/antipyretic is needed.',
      });
    }

    if (hasDuplicatePain) {
      alerts.push({
        severity: 'moderate',
        drugs: ['Multiple NSAIDs'],
        description: 'Duplicate NSAID therapy offers no increased analgesic efficacy but multiplies renal and ulcer toxicity.',
        recommendation: 'Dispense a single NSAID agent only.',
      });
    }

    return json({
      has_interactions: alerts.length > 0,
      summary: alerts.length > 0 ? `Identified ${alerts.length} potential medication interaction alert(s)` : 'No known major interactions detected',
      alerts,
    });
  }

  // 3. PATIENT COUNSELING SLIP GENERATOR
  if (method === 'POST' && segment === 'counseling') {
    const body = await request.json().catch(() => ({}));
    const { medicine_name, dosage, patient_name } = body;

    try {
      const ai = getAiClient();
      if (ai && medicine_name) {
        const prompt = `Generate friendly, clear patient counseling guidelines for dispensing ${medicine_name} (${dosage || 'standard dose'}) to patient ${patient_name || 'Patient'}.
Include:
1. When and how to take it (with food/water/time of day).
2. Key precautions (driving, alcohol, sunlight).
3. Common side effects and when to contact the doctor.
Format in 3 short, easy-to-read bullet points.`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        if (response && response.text) {
          return json({ counseling: response.text });
        }
      }
    } catch (e) {
      console.warn('AI counseling generator fallback:', e.message);
    }

    return json({
      counseling: `• Take ${medicine_name || 'medication'} exactly as prescribed. Complete the full course even if symptoms improve.\n• Take with plenty of water and food if stomach upset occurs.\n• Store in a cool, dry place away from direct sunlight and out of reach of children.`,
    });
  }

  // 4. DRUG INFO SEARCH
  if (method === 'GET' && segment === 'drug-info') {
    const name = parts[1];
    if (!name) {
      return json({ error: 'Drug name is required' }, 400);
    }
    const decoded = decodeURIComponent(name);
    const matches = await findMedicineInfo(decoded);
    if (matches.length === 0) {
      const dbResults = await all(
        db,
        `SELECT m.*, mc.name as category_name, COALESCE(SUM(b.quantity), 0) as stock
         FROM medicines m
         LEFT JOIN medicine_categories mc ON mc.id = m.category_id
         LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
         WHERE (m.brand_name LIKE ? OR m.generic_name LIKE ?) AND m.is_active = 1
         GROUP BY m.id`,
        [`%${decoded}%`, `%${decoded}%`]
      );
      return json({ results: dbResults, source: 'database' });
    }
    return json({ results: matches, source: 'knowledge_base' });
  }

  // 5. INVENTORY FORECAST
  if (method === 'GET' && segment === 'inventory-forecast') {
    const medicines = await all(
      db,
      `SELECT m.id, m.brand_name, m.generic_name, m.default_selling_price,
              COALESCE(SUM(b.quantity), 0) as total_stock,
              (SELECT COUNT(*) FROM sales s JOIN sale_items si ON si.sale_id = s.id
               WHERE si.medicine_id = m.id AND s.status = 'completed') as sale_count,
              (SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si
               JOIN sales s ON s.id = si.sale_id
               WHERE si.medicine_id = m.id AND s.status = 'completed') as total_sold
       FROM medicines m
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       WHERE m.is_active = 1
       GROUP BY m.id
       ORDER BY total_stock ASC
       LIMIT 40`
    );

    const forecasts = medicines.map((med) => {
      const avgDaily = Math.max(0.5, (med.total_sold || 0) / 14);
      const daysUntilReorder = avgDaily > 0 ? Math.max(0, med.total_stock / avgDaily) : 99;
      let status = 'ok';
      let reorder_urgency = 'low';

      if (med.total_stock <= 0) {
        status = 'out_of_stock';
        reorder_urgency = 'critical';
      } else if (med.total_stock <= 15) {
        status = 'low_stock';
        reorder_urgency = 'high';
      } else if (med.total_stock <= 30) {
        status = 'reorder_soon';
        reorder_urgency = 'medium';
      }

      return {
        medicine_id: med.id,
        medicine_name: med.brand_name,
        generic_name: med.generic_name,
        current_stock: med.total_stock,
        avg_daily_sales: avgDaily.toFixed(1),
        days_until_reorder: Math.round(daysUntilReorder),
        status,
        reorder_urgency,
        suggested_order: Math.max(20, Math.ceil(avgDaily * 30 - med.total_stock)),
      };
    });

    return json({ forecasts, generated_at: new Date().toISOString() });
  }

  return json({ error: 'Not found' }, 404);
}
