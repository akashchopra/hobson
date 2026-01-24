// Phase 5: Create Test Views
// Run this in the Hobson REPL after Phase 4

(async function() {
  const IDS = api.IDS;
  const VIEW_TYPE = "aaaaaaaa-0000-0000-0000-000000000000";
  const VIEW_SPEC_TYPE = "bbbbbbbb-0000-0000-0000-000000000000";

  console.log("Phase 5: Creating test views for validation...");

  // First, let's create a test type to use with our views
  const testTypeId = crypto.randomUUID();
  const testType = {
    id: testTypeId,
    name: "test_article",
    type: IDS.TYPE_DEFINITION,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      description: "Test article type for demonstrating unified view system"
    }
  };

  await api.set(testType);
  console.log("Created test_article type: " + testTypeId);

  // 1. Create an imperative view (code-based)
  const imperativeView = {
    id: crypto.randomUUID(),
    name: "test_article_card_view",
    type: VIEW_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      for_type: testTypeId,
      capabilities: ["read"],
      description: "Card-style readonly view for test articles",
      code: `
export async function render(item, api) {
  const container = api.createElement('div', {
    className: 'article-card-view',
    style: 'border: 1px solid #ddd; border-radius: 8px; padding: 20px; max-width: 600px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'
  });

  // Title
  const title = api.createElement('h2', {
    style: 'margin: 0 0 10px 0; color: #333;'
  });
  title.textContent = item.content?.title || 'Untitled Article';
  container.appendChild(title);

  // Author badge
  if (item.content?.author) {
    const author = api.createElement('div', {
      style: 'font-size: 14px; color: #666; margin-bottom: 15px;'
    });
    author.textContent = 'By ' + item.content.author;
    container.appendChild(author);
  }

  // Body preview
  const body = api.createElement('div', {
    style: 'line-height: 1.6; color: #444;'
  });
  const bodyText = item.content?.body || '';
  body.textContent = bodyText.length > 300 ? bodyText.slice(0, 300) + '...' : bodyText;
  container.appendChild(body);

  // Metadata footer
  const footer = api.createElement('div', {
    style: 'margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; display: flex; justify-content: space-between; font-size: 12px; color: #888;'
  });

  const created = api.createElement('span');
  created.textContent = 'Created: ' + new Date(item.created).toLocaleDateString();
  footer.appendChild(created);

  if (item.content?.published) {
    const published = api.createElement('span', {
      style: 'background: #28a745; color: white; padding: 2px 8px; border-radius: 12px;'
    });
    published.textContent = 'Published';
    footer.appendChild(published);
  }

  container.appendChild(footer);

  return container;
}
`
    }
  };

  await api.set(imperativeView);
  console.log("Created imperative view: test_article_card_view");

  // 2. Create a declarative view-spec (form-based with mixed modes)
  const declarativeViewSpec = {
    id: crypto.randomUUID(),
    name: "test_article_form_view",
    type: VIEW_SPEC_TYPE,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      for_type: testTypeId,
      description: "Form-based view for editing test articles with mixed readonly/editable fields",
      ui_hints: {
        "id": {
          field_view: "text",
          mode: "readonly",
          hidden: true
        },
        "type": {
          field_view: "text",
          mode: "readonly",
          hidden: true
        },
        "created": {
          field_view: "timestamp",
          mode: "readonly",
          label: "Created",
          format: "full"
        },
        "modified": {
          field_view: "timestamp",
          mode: "readonly",
          label: "Last Modified",
          format: "relative"
        },
        "content.title": {
          field_view: "text",
          mode: "editable",
          label: "Title",
          placeholder: "Enter article title..."
        },
        "content.author": {
          field_view: "text",
          mode: "editable",
          label: "Author",
          placeholder: "Author name"
        },
        "content.body": {
          field_view: "textarea",
          mode: "editable",
          label: "Content",
          placeholder: "Write your article here...",
          rows: 10
        },
        "content.published": {
          field_view: "checkbox",
          mode: "editable",
          label: "Published"
        },
        "content.rating": {
          field_view: "number",
          mode: "editable",
          label: "Rating",
          min: 1,
          max: 5,
          step: 1
        }
      }
    }
  };

  await api.set(declarativeViewSpec);
  console.log("Created declarative view-spec: test_article_form_view");

  // 3. Create a test article item to view
  const testArticle = {
    id: crypto.randomUUID(),
    name: "Test Article - Hello World",
    type: testTypeId,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      title: "Hello World",
      author: "Test Author",
      body: "This is a test article to demonstrate the unified view system. The view system allows for both imperative (code-based) views and declarative (spec-based) views. Each field can be configured as readonly or editable independently.",
      published: false,
      rating: 4
    }
  };

  await api.set(testArticle);
  console.log("Created test article: " + testArticle.id);

  console.log("\\nPhase 5 complete! Created test items:");
  console.log("\\nTest Type:");
  console.log("  - test_article (" + testTypeId + ")");
  console.log("\\nViews:");
  console.log("  - test_article_card_view (imperative) - " + imperativeView.id);
  console.log("  - test_article_form_view (declarative) - " + declarativeViewSpec.id);
  console.log("\\nTest Data:");
  console.log("  - Test Article: " + testArticle.id);
  console.log("\\nTo test:");
  console.log("  1. Reload kernel to pick up changes");
  console.log("  2. Navigate to the test article: api.navigate('" + testArticle.id + "')");
  console.log("  3. The card view should render by default (it's a view, found first)");
  console.log("  4. To test the form view, you can use the rendering API");

  return {
    testType,
    imperativeView,
    declarativeViewSpec,
    testArticle
  };
})();
