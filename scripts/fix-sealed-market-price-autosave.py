from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected text for {label}")
    return text.replace(old, new, 1)

# Force phones to load the corrected sealed scanner.
index = Path('index.html')
html = index.read_text(encoding='utf-8')
html = replace_once(
    html,
    'sealed-product-scout.js?v=6.1.4',
    'sealed-product-scout.js?v=6.1.5',
    'sealed scanner cache version',
)
index.write_text(html, encoding='utf-8')

app_path = Path('sealed-product-scout.js')
app = app_path.read_text(encoding='utf-8')

old = '''  async function runValueResearch(){
    const draft=readDraft(),status=byId("sealedPriceStatus"),btn=byId("sealedResearchPreviewBtn");
    if(!draft.confirmed||!draft.identity){status.className="sealed-status warn";status.textContent="Confirm the exact product first.";return;}
    const shelfPrice=Number(draft.shelfPrice);
    if(!Number.isFinite(shelfPrice)||shelfPrice<=0){status.className="sealed-status warn";status.textContent="Save the shelf price first.";byId("sealedShelfPrice")?.focus();return;}
'''
new = '''  async function runValueResearch(){
    let draft=readDraft();
    const status=byId("sealedPriceStatus"),btn=byId("sealedResearchPreviewBtn");
    if(!draft.confirmed||!draft.identity){status.className="sealed-status warn";status.textContent="Confirm the exact product first.";return;}

    // The market button should use what is currently visible in the shelf-price field.
    // Do not make the user tap SAVE SHELF PRICE first.
    const rawField=byId("sealedShelfPrice")?.value.trim()||"";
    const fieldPrice=Number(rawField.replace(/[$,]/g,""));
    let shelfPrice=Number(draft.shelfPrice);
    if(rawField){
      if(!Number.isFinite(fieldPrice)||fieldPrice<=0){
        status.className="sealed-status warn";
        status.textContent="Enter a valid shelf price before checking the market.";
        byId("sealedShelfPrice")?.focus();
        return;
      }
      shelfPrice=Number(fieldPrice.toFixed(2));
      draft=saveDraft({shelfPrice,store:byId("sealedStore")?.value.trim()||draft.store||"",marketResearch:null});
    }
    if(!Number.isFinite(shelfPrice)||shelfPrice<=0){status.className="sealed-status warn";status.textContent="Enter the shelf price before checking the market.";byId("sealedShelfPrice")?.focus();return;}
'''
app = replace_once(app, old, new, 'market research shelf price gate')

app = replace_once(
    app,
    'Save the shelf price, then Scout can compare it with current matching eBay listings.',
    'Enter the shelf price, then Scout can compare it with current matching eBay listings. Tapping Check Market Value saves the price automatically.',
    'step 3 help text',
)

app_path.write_text(app, encoding='utf-8')

# Protect the corrected behavior with a regression assertion.
test_path = Path('tests/sealed-product-vision.test.cjs')
test = test_path.read_text(encoding='utf-8')
needle = "assert.match(app,/sealed\\/value-check/,'front end must call the sealed market endpoint');\n"
insert = needle + "assert.match(app,/rawField=byId\\(\\\"sealedShelfPrice\\\"\\)/,'market check must read the currently entered shelf price');\nassert.match(app,/saveDraft\\(\\{shelfPrice,store:/,'market check must auto-save the entered shelf price');\n"
if 'market check must auto-save the entered shelf price' not in test:
    test = replace_once(test, needle, insert, 'market price autosave regression test')
test_path.write_text(test, encoding='utf-8')
