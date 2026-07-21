// website/functions/api/comments.js
// Cloudflare Pages Function (Worker API endpoint)

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const bookId = url.searchParams.get("bookId");
  const pageId = url.searchParams.get("pageId");

  if (!bookId || !pageId) {
    return new Response(JSON.stringify({ error: "Missing bookId or pageId" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // Fallback if D1 is not bound yet to prevent frontend crashes
  if (!env.DB) {
    return new Response(
      JSON.stringify({
        warning: "Cloudflare D1 binding 'DB' is missing. Please bind your D1 database to the Pages project.",
        comments: {}
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }

  try {
    const { results } = await env.DB.prepare(
      "SELECT id, element_id, username, text, created_at FROM comments WHERE book_id = ? AND page_id = ? ORDER BY created_at ASC"
    ).bind(bookId, pageId).all();

    // Group comments by element_id
    const grouped = {};
    results.forEach(comment => {
      const elId = comment.element_id;
      if (!grouped[elId]) {
        grouped[elId] = [];
      }
      grouped[elId].push({
        id: comment.id,
        username: comment.username,
        text: comment.text,
        createdAt: comment.created_at
      });
    });

    return new Response(JSON.stringify({ comments: grouped }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Enable CORS preflight response support
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Cloudflare D1 binding 'DB' is missing in settings." }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  try {
    const body = await request.json();
    const { bookId, pageId, elementId, username, text } = body;

    if (!bookId || !pageId || !elementId || !username || !text) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const { success } = await env.DB.prepare(
      "INSERT INTO comments (book_id, page_id, element_id, username, text) VALUES (?, ?, ?, ?, ?)"
    ).bind(bookId, pageId, elementId, username, text).run();

    if (!success) {
      throw new Error("Failed to insert comment.");
    }

    // Retrieve the newly inserted comment
    const lastComment = await env.DB.prepare(
      "SELECT id, element_id, username, text, created_at FROM comments WHERE book_id = ? AND page_id = ? AND element_id = ? ORDER BY id DESC LIMIT 1"
    ).bind(bookId, pageId, elementId).first();

    return new Response(
      JSON.stringify({
        id: lastComment.id,
        element_id: lastComment.element_id,
        username: lastComment.username,
        text: lastComment.text,
        createdAt: lastComment.created_at
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing comment id" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Cloudflare D1 database is not bound." }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  try {
    const { success } = await env.DB.prepare(
      "DELETE FROM comments WHERE id = ?"
    ).bind(id).run();

    if (!success) {
      throw new Error("Failed to delete comment from database.");
    }

    return new Response(JSON.stringify({ success: true, id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

