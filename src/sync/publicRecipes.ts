import { type Moment, type Payload, momentsOf, payloadParam, recipePayload } from '../logic/recipeShare';
import type { Ingredient, Recipe } from '../logic/types';
import { supabase } from './client';
import { ensureUser } from './family';

/** o rețetă publicată de cineva (pentru „Rețete de la alții”) */
export interface PublicRecipe { id: string; author_id: string; author_name: string; name: string; moments: Moment[]; recipe: Payload; created_at: string }

export async function listPublic(search?: string, moment?: Moment): Promise<PublicRecipe[]> {
  let q = supabase.from('public_recipes').select('id,author_id,author_name,name,moments,recipe,created_at').order('created_at', { ascending: false }).limit(60);
  if (search?.trim()) q = q.ilike('name', `%${search.trim().replace(/[%_]/g, '')}%`);
  if (moment) q = q.contains('moments', [moment]);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PublicRecipe[];
}

/** publici rețeta ta pentru toată lumea (sau o actualizezi, dacă ai mai publicat-o) */
export async function publishRecipe(r: Recipe, customIngredients: Ingredient[], authorName: string, existingId?: string): Promise<string> {
  await ensureUser();
  const row = { author_name: authorName.trim().slice(0, 60) || 'Anonim', name: r.name.trim().slice(0, 120), moments: momentsOf(r), recipe: recipePayload({ ...r, author: authorName.trim() || r.author }, customIngredients), updated_at: new Date().toISOString() };
  if (existingId) {
    const { error } = await supabase.from('public_recipes').update(row).eq('id', existingId);
    if (error) throw error;
    return existingId;
  }
  const { data, error } = await supabase.from('public_recipes').insert(row).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function unpublishRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('public_recipes').delete().eq('id', id);
  if (error) throw error;
}

export async function reportRecipe(id: string): Promise<void> {
  await ensureUser();
  const { error } = await supabase.rpc('report_recipe', { p_recipe: id });
  if (error) throw error;
}

export async function myUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

/** parametrul pentru ecranul de import (previzualizare și „Pune-o la rețetele mele”) */
export const importParam = (p: PublicRecipe) => payloadParam({ ...p.recipe, a: p.author_name });
