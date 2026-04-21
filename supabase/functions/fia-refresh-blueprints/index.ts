import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * FIA Blueprint Refresh Edge Function
 *
 * Scheduled via pg_cron to run daily. Fetches the latest FIA pericope data
 * for all languages that have FIA blueprints, and applies additive changes
 * (new books, new pericopes) to the source blueprints.
 *
 * Invoked by: pg_cron via pg_net HTTP call to this function
 * No request body needed — discovers languages from existing blueprints.
 */

interface BlueprintNode {
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
  children?: BlueprintNode[];
}

interface BlueprintStructure {
  format_version: number;
  root: BlueprintNode;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all FIA-type source blueprints (non-frozen, auto_sync)
    const { data: blueprints, error: bpError } = await supabase
      .from('template_blueprint')
      .select('id, slug, structure, structure_version, source_language_id')
      .eq('active', true)
      .eq('auto_sync', true)
      .eq('locked_for_backward_compat', false)
      .ilike('slug', 'fia-%');

    if (bpError) {
      console.error('Failed to fetch FIA blueprints:', bpError);
      return new Response(JSON.stringify({ error: bpError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!blueprints?.length) {
      return new Response(
        JSON.stringify({ message: 'No FIA blueprints to refresh', updated: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let updated = 0;

    for (const bp of blueprints) {
      try {
        // Get the FIA language code from the blueprint's metadata or slug
        const languageCode = bp.slug?.replace('fia-source-', '').replace('fia-', '');
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

        const structure = bp.structure as BlueprintStructure;
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
          const newVersion = bp.structure_version + 1;
          const { error: updateError } = await supabase
            .from('template_blueprint')
            .update({
              structure,
              structure_version: newVersion,
              last_updated: new Date().toISOString()
            })
            .eq('id', bp.id)
            .eq('structure_version', bp.structure_version);

          if (updateError) {
            console.error(`Failed to update blueprint ${bp.id}:`, updateError);
          } else {
            // Record revision
            await supabase.from('blueprint_revision').insert({
              blueprint_id: bp.id,
              structure_version: newVersion,
              structure,
              saved_by: null
            });
            updated++;
            console.log(`Updated FIA blueprint ${bp.slug} to v${newVersion}`);
          }
        }
      } catch (err) {
        console.error(`Error processing blueprint ${bp.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ message: `Refreshed ${updated} FIA blueprints`, updated }),
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
