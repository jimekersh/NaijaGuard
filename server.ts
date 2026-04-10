import express from 'express';
import { createServer } from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const summaryCache = new Map<string, { summary: string, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

// External Ingestion Service
class IngestionService {
  private ai: any;

  constructor(ai: any) {
    this.ai = ai;
  }

  async ingestFromSource(sourceName: string, rawData: string) {
    console.log(`[INGESTION] Processing data from ${sourceName}...`);
    
    try {
      const model = 'gemini-3-flash-preview';
      const prompt = `Extract security threat information from this ${sourceName} feed. 
      Data: "${rawData}"
      
      Return a JSON object with:
      - category: (one of: robbery, kidnapping, protest, accident, fire, other)
      - description: (concise summary)
      - state: (Nigerian state)
      - lga: (Local Government Area if mentioned)
      - riskLevel: (low, medium, high, critical)
      - aiCredibilityScore: (0 to 1 based on source detail)
      
      If no threat is found, return { "error": "no_threat" }.`;

      const response = await this.ai.models.generateContent({ model, contents: prompt });
      const result = JSON.parse(response.text || '{}');

      if (result.error) return;

      const reportId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const report = {
        id: reportId,
        userId: 'system_ingest',
        isAnonymous: false,
        category: result.category || 'other',
        description: result.description || rawData.substring(0, 200),
        state: result.state || 'Lagos',
        lga: result.lga || '',
        timestamp: Date.now(),
        riskLevel: result.riskLevel || 'medium',
        status: 'verified',
        aiCredibilityScore: result.aiCredibilityScore || 0.8,
        source: sourceName,
        sourceUrl: '#'
      };

      const { error } = await supabase.from('reports').insert([report]);
      if (error) throw error;

      console.log(`[INGESTION] Successfully ingested report from ${sourceName}: ${report.id}`);
    } catch (e) {
      console.error(`[INGESTION] Failed to process ${sourceName}:`, e);
    }
  }

  startSimulatedIngestion() {
    const newsOutlets = ['Punch', 'Vanguard', 'Legit.ng', 'X (Twitter)', 'Facebook'];
    const mockFeeds = [
      "Breaking: Heavy protest reported along Ikorodu Road, Lagos. Commuters advised to take alternative routes.",
      "Security Alert: Armed robbery incident at a bank in Owerri, Imo State. Police currently on scene.",
      "Traffic Update: Multiple vehicle collision on Lagos-Ibadan Expressway near Berger. Emergency services responding.",
      "Report: Fire outbreak at a market in Kano. Firefighters battling the blaze.",
      "Kidnapping attempt foiled by security operatives in Kaduna. Three suspects apprehended."
    ];

    setInterval(() => {
      const source = newsOutlets[Math.floor(Math.random() * newsOutlets.length)];
      const feed = mockFeeds[Math.floor(Math.random() * mockFeeds.length)];
      this.ingestFromSource(source, feed);
    }, 1000 * 60 * 15); // Every 15 minutes
  }
}

const app = express();

async function startServer() {
  app.set('trust proxy', 1); // Trust first proxy (Cloud Run/Nginx)
  const httpServer = createServer(app);

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  app.use(express.json());

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { error: 'AI limit reached. Please wait an hour.' }
  });

  app.use('/api/', apiLimiter);
  app.use('/api/intelligence/', aiLimiter);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const ingestion = new IngestionService(ai);
  ingestion.startSimulatedIngestion();

  // API Routes
  app.post('/api/sos', async (req, res) => {
    const { location, userId } = req.body;
    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({ error: 'Location is required' });
    }

    try {
      const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
      const signalId = Math.random().toString(36).substr(2, 9);
      const timestamp = Date.now();

      await supabase.from('distress_signals').insert([{ 
        id: signalId, 
        userId: userId || 'anonymous', 
        realName: user?.realName || 'Anonymous', 
        lat: location.lat, 
        lng: location.lng, 
        timestamp, 
        status: 'active' 
      }]);

      res.json({ success: true, signalId });
    } catch (error) {
      console.error('SOS Error:', error);
      res.status(500).json({ error: 'Failed to broadcast SOS' });
    }
  });

  app.get('/api/reports', async (req, res) => {
    const { data: reports, error } = await supabase.from('reports').select('*').order('timestamp', { ascending: false }).limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json(reports);
  });

  app.post('/api/reports', async (req, res) => {
    const reportData = req.body;
    
    // AI Analysis
    let aiScore = 0.5;
    let riskLevel = reportData.riskLevel || 'moderate';
    let aiThreatType = '';
    let aiAnalysisSummary = '';

    if (process.env.GEMINI_API_KEY) {
      try {
        const model = 'gemini-3-flash-preview';
        const prompt = `Analyze this security report from Nigeria:
        Report: "${reportData.description}"
        State: "${reportData.state}"
        LGA: "${reportData.lga}"

        Return ONLY a JSON object:
        {
          "threatType": "string",
          "urgency": "critical|high|moderate|low",
          "credibilityScore": number,
          "isMisinformation": boolean,
          "analysisSummary": "string"
        }`;
        
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        });
        
        const result = JSON.parse(response.text || '{}');
        riskLevel = result.urgency || riskLevel;
        aiScore = result.credibilityScore || 0.5;
        aiThreatType = result.threatType || '';
        aiAnalysisSummary = result.analysisSummary || '';
      } catch (e) {
        console.error('AI Error:', e);
      }
    }

    const id = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();

    const report = {
      id, 
      userId: reportData.userId, 
      isAnonymous: !!reportData.isAnonymous, 
      category: reportData.category || 'other', 
      description: reportData.description, 
      state: reportData.state, 
      lga: reportData.lga || '', 
      lat: reportData.lat || null, 
      lng: reportData.lng || null, 
      timestamp, 
      riskLevel, 
      aiCredibilityScore: aiScore, 
      aiThreatType, 
      aiAnalysisSummary, 
      status: 'pending'
    };

    await supabase.from('reports').insert([report]);
    res.json(report);
  });

  app.get('/api/intelligence/summary/:state', async (req, res) => {
    const { state } = req.params;
    
    const cached = summaryCache.get(state);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return res.json({ summary: cached.summary, cached: true });
    }

    const yesterday = Date.now() - (24 * 60 * 60 * 1000);
    const { data: reports } = await supabase.from('reports')
      .select('category, lga, description')
      .eq('state', state)
      .gt('timestamp', yesterday)
      .limit(50);

    if (!reports || reports.length === 0) {
      return res.json({ summary: `No significant security incidents reported in ${state} in the last 24 hours.` });
    }

    if (process.env.GEMINI_API_KEY) {
      try {
        const model = 'gemini-3-flash-preview';
        const prompt = `Generate a concise daily safety summary for ${state}, Nigeria based on these recent reports: ${JSON.stringify(reports)}`;
        const response = await ai.models.generateContent({ model, contents: prompt });
        const summary = response.text || 'Summary unavailable.';
        summaryCache.set(state, { summary, timestamp: Date.now() });
        res.json({ summary });
      } catch (e) {
        res.status(500).json({ error: 'AI Error' });
      }
    } else {
      res.status(400).json({ error: 'AI Key missing' });
    }
  });

  app.get('/api/distress-signals', async (req, res) => {
    const { data: signals } = await supabase.from('distress_signals').select('*').eq('status', 'active').order('timestamp', { ascending: false });
    res.json(signals || []);
  });

  app.post('/api/register-individual', async (req, res) => {
    const { userId, realName, phoneNumber } = req.body;
    const { data: existing } = await supabase.from('users').select('*').eq('id', userId).single();
    if (existing) {
      await supabase.from('users').update({ isRegisteredIndividual: true, realName, phoneNumber }).eq('id', userId);
    } else {
      await supabase.from('users').insert([{ id: userId, realName, phoneNumber, isRegisteredIndividual: true }]);
    }
    res.json({ status: 'registered' });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  httpServer.listen(3000, '0.0.0.0', () => {
    console.log('NaijaGuard Server running on port 3000');
  });
}

if (process.env.NODE_ENV !== 'production' || !process.env.NETLIFY) {
  startServer();
}

export { app };
