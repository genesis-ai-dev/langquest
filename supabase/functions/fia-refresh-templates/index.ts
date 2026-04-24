import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * FIA Template Refresh Edge Function
 *
 * Scheduled via pg_cron to run daily. Fetches the latest FIA pericope data
 * for all languages that have FIA templates, and applies additive changes
 * (new books, new pericopes) to the source templates.
 *
 * Invoked by: pg_cron via pg_net HTTP call to this function
 * No request body needed — discovers languages from existing templates.
 */

interface TemplateNode {
  id: string;
  name: string;
  short_label?: string;
  label_template?: string;
  node_type?: string;
  linkable_type?: 'quest' | 'asset' | 'both' | null;
  is_download_unit?: boolean;
  is_version_anchor?: boolean;
  allows_spanning?: boolean;
  deleted?: boolean;
  metadata?: Record<string, unknown>;
  children?: TemplateNode[];
}

interface TemplateStructure {
  format_version: number;
  root: TemplateNode;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all FIA-type source templates (non-frozen, auto_sync)
    const { data: templates, error: tmplError } = await supabase
      .from('template')
      .select('id, slug, structure, source_language_id')
      .eq('active', true)
      .eq('auto_sync', true)
      .eq('locked_for_backward_compat', false)
      .ilike('slug', 'fia-%');

    if (tmplError) {
      console.error('Failed to fetch FIA templates:', tmplError);
      return new Response(JSON.stringify({ error: tmplError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!templates?.length) {
      return new Response(
        JSON.stringify({ message: 'No FIA templates to refresh', updated: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let updated = 0;

    for (const tmpl of templates) {
      try {
        // Get the FIA language code from the template's metadata or slug
        const languageCode = tmpl.slug?.replace('fia-source-', '').replace('fia-', '');
        if (!languageCode) continue;

        // Fetch fresh pericope data from the FIA pericopes edge function
        const pericopeResponse = await fetch(
          `${supabaseUrl}/functions/v1/fia-pericopes`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceRoleKey}`
            },
            body: JSON.stringify({ fiaLanguageCode: languageCode })
          }
        );

        if (!pericopeResponse.ok) {
          console.error(`Failed to fetch pericopes for ${languageCode}: ${pericopeResponse.status}`);
          continue;
        }

        const pericopeData = await pericopeResponse.json();
        if (!pericopeData.books?.length) continue;

        const structure = tmpl.structure as TemplateStructure;
        const existingBookIds = new Set<string>();
        const existingPericopeIds = new Set<string>();

        // Index existing nodes
        for (const book of structure.root.children ?? []) {
          if (book.deleted) continue;
          existingBookIds.add(book.id);
          for (const pericope of book.children ?? []) {
            if (pericope.deleted) continue;
            existingPericopeIds.add(pericope.id);
          }
        }

        let changed = false;

        for (const fiaBook of pericopeData.books) {
          let bookNode = structure.root.children?.find(
            (n) => !n.deleted && n.metadata?.fia?.bookId === fiaBook.id
          );

          if (!bookNode) {
            bookNode = {
              id: fiaBook.id,
              name: fiaBook.title,
              node_type: 'book',
              linkable_type: 'quest',
              is_download_unit: true,
              metadata: { fia: { bookId: fiaBook.id } },
              children: []
            };
            if (!structure.root.children) structure.root.children = [];
            structure.root.children.push(bookNode);
            changed = true;
          }

          for (const pericope of fiaBook.pericopes ?? []) {
            const exists = bookNode.children?.some(
              (n) => !n.deleted && n.metadata?.fia?.pericopeId === pericope.id
            );

            if (!exists) {
              if (!bookNode.children) bookNode.children = [];
              bookNode.children.push({
                id: pericope.id,
                name: `${pericope.verseRange}`,
                short_label: pericope.verseRange,
                node_type: 'pericope',
                linkable_type: 'quest',
                allows_spanning: true,
                metadata: {
                  fia: {
                    pericopeId: pericope.id,
                    verseRange: pericope.verseRange,
                    sequence: pericope.sequence
                  }
                },
                children: []
              });
              changed = true;
            }
          }
        }

        if (changed) {
          const { error: updateError } = await supabase
            .from('template')
            .update({
              structure,
              last_updated: new Date().toISOString()
            })
            .eq('id', tmpl.id);

          if (updateError) {
            console.error(`Failed to update template ${tmpl.id}:`, updateError);
          } else {
            await supabase.from('template_revision').insert({
              template_id: tmpl.id,
              structure,
              saved_by: null
            });
            updated++;
            console.log(`Updated FIA template ${tmpl.slug}`);
          }
        }
      } catch (err) {
        console.error(`Error processing template ${tmpl.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ message: `Refreshed ${updated} FIA templates`, updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('FIA refresh failed:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
