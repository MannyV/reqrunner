// Supabase initialization and helper functions
// In a real project, you would use: import { createClient } from '@supabase/supabase-js'
// For this extension, we'll use the CDN version in the HTML or a bundled version.

let supabaseClient = null;

export async function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const { supabaseUrl, supabaseKey } = await chrome.storage.local.get(['supabaseUrl', 'supabaseKey']);

  if (!supabaseUrl || !supabaseKey) {
    supabaseClient = null; // Clear if not found
    console.warn('Supabase credentials not found in storage');
    return null;
  }

  // We assume supabase is loaded globally via a script tag in popup.html or background.js
  // Or we dynamic import it if possible.
  if (typeof supabase === 'undefined') {
    // Fallback: try to import from CDN if in a context that supports it
    // Note: Chrome Extensions have strict CSP. Usually, you bundle this.
    console.error('Supabase library not loaded. Please ensure it is bundled or included via script tag.');
    return null;
  }

  supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}

export async function signIn(email, password) {
  const client = await getSupabase();
  if (!client) throw new Error('Supabase not initialized');
  return await client.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password) {
  const client = await getSupabase();
  if (!client) throw new Error('Supabase not initialized');
  return await client.auth.signUp({ email, password });
}

export async function getSession() {
  const client = await getSupabase();
  if (!client) return null;
  const { data: { session } } = await client.auth.getSession();
  return session;
}

export async function signOut() {
  const client = await getSupabase();
  if (client) await client.auth.signOut();
}
