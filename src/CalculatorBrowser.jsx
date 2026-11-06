import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ClipboardList, Copy, MessageCircle, Package,
  Minus, Plus, Printer, RotateCcw, Search, Send, Trash2,
} from "lucide-react";
import { asrSortSizes, calculatorQuoteItem, calculatorReviewItem, inr, num } from "./utils";
import "./calculator.css";

export default function CalculatorBrowser({
  categories, sizes, categoryId, onCategoryChange, selections, setSelections,
  isAdmin, isSalesman, assignedMargin, defaultMargin, onDefaultMarginChange,
  onAdd, onUpdate, cart, quoteText, onQuoteChange, onDeleteRow, onDeleteAll,
  onCopy, onWhatsapp, onShare, onPrint, onReset, onOrder,
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("browse");
  const [catalogPage, setCatalogPage] = useState(0);
  const [reviewSelections, setReviewSelections] = useState([]);
  const catalogRef = useRef(null);
  const catalogPageRef = useRef(0);
  const scrollTimerRef = useRef(null);
  const activeCategory = categories.find((category) => category.id === categoryId);
  const activeSizes = asrSortSizes(sizes.filter((size) =>
    size.category_id === categoryId && size.name.toLowerCase().includes(search.trim().toLowerCase()),
  ));
  const pageSize = 9;
  const pageCount = Math.max(1, Math.ceil(activeSizes.length / pageSize));
  const currentPage = Math.min(catalogPage, pageCount - 1);
  const selectedIds = new Set(selections.map((selection) => selection.rateItemId));
  const resolvedSelections = selections.map((selection) => {
    const category = categories.find((row) => row.id === selection.categoryId);
    const size = sizes.find((row) => row.id === selection.rateItemId);
    return {
      ...selection,
      quote: category && size
        ? calculatorQuoteItem(category, size, selection, isSalesman, assignedMargin)
        : null,
    };
  });
  const invalidSelection = resolvedSelections.some((selection) =>
    !selection.quote || !selection.itemName.trim() ||
    !Number.isFinite(selection.quote.unitRate) || !Number.isFinite(selection.quote.total) ||
    selection.quote.qty < 0 || !Number.isFinite(selection.quote.qty),
  );
  const resolvedReviewSelections = reviewSelections.map((selection) => ({
    ...selection,
    quote: calculatorReviewItem(
      categories.find((row) => row.id === selection.categoryId),
      sizes.find((row) => row.id === selection.rateItemId),
      selection, isSalesman, assignedMargin,
    ),
  }));
  const invalidReview = resolvedReviewSelections.some((selection) =>
    !selection.quote || !selection.itemName.trim() ||
    !Number.isFinite(selection.quote.unitRate) || !Number.isFinite(selection.quote.total) ||
    selection.quote.qty < 0 || !Number.isFinite(selection.quote.qty) ||
    (selection.margin !== "" && num(selection.margin) < 0),
  );

  useEffect(() => {
    const track = catalogRef.current;
    if (!track) return;
    const observer = new ResizeObserver(() => {
      track.scrollLeft = Math.min(catalogPageRef.current, pageCount - 1) * track.clientWidth;
    });
    observer.observe(track);
    return () => {
      observer.disconnect();
      clearTimeout(scrollTimerRef.current);
    };
  }, [categoryId, search, pageCount]);

  function resetCatalogPage() {
    catalogPageRef.current = 0;
    setCatalogPage(0);
  }

  function moveCatalogPage(nextPage) {
    catalogPageRef.current = nextPage;
    setCatalogPage(nextPage);
    const track = catalogRef.current;
    track?.scrollTo({
      left: nextPage * track.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  function changeView(nextView) {
    if (nextView === "selected") {
      setReviewSelections(cart.map((item) => ({ ...item, margin: "" })));
    }
    setView(nextView);
  }

  function addToQuotation() {
    if (!selections.length || invalidSelection) return;
    onAdd(resolvedSelections.map((selection) => ({
      ...selection.quote, categoryId: selection.categoryId, rateItemId: selection.rateItemId,
    })));
    setView("quotation");
  }

  function stepMargin(amount) {
    changeMargin(String(Math.max(0, Math.round((num(defaultMargin) + amount) * 100) / 100)));
  }

  function changeMargin(value) {
    onDefaultMarginChange(value);
    setSelections((previous) => previous.map((selection) => ({ ...selection, margin: value })));
  }

  function toggleSize(size) {
    setSelections((previous) => previous.some((row) => row.rateItemId === size.id)
      ? previous.filter((row) => row.rateItemId !== size.id)
      : [...previous, {
        rateItemId: size.id, categoryId: size.category_id, itemName: size.name,
        qty: "", qtyUnit: "kg", margin: defaultMargin,
      }]);
  }

  function editSelection(id, patch) {
    setReviewSelections((previous) => previous.map((selection) =>
      selection.id === id ? { ...selection, ...patch } : selection,
    ));
  }

  return (
    <div className="estimate-browser">
      {isAdmin && <header className="estimate-heading">
        <div className="estimate-margin-toolbar">
          <div className="estimate-margin-row">
            <label htmlFor="estimate-margin" title="Margin per kg">Margin</label>
            <div className="estimate-margin-stepper">
              <button type="button" className="estimate-icon-button" aria-label="Decrease margin by 0.5" title="Decrease margin by 0.5" disabled={num(defaultMargin) <= 0} onClick={() => stepMargin(-0.5)}><Minus size={18} /></button>
              <span className="estimate-margin-control"><span aria-hidden="true">₹</span><input id="estimate-margin" aria-label="Margin per kg" type="number" inputMode="decimal" min="0" step="0.01" value={defaultMargin} placeholder="0" onChange={(event) => {
                const value = event.target.value;
                if (value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0)) changeMargin(value);
              }} /></span>
              <button type="button" className="estimate-icon-button" aria-label="Increase margin by 0.5" title="Increase margin by 0.5" onClick={() => stepMargin(0.5)}><Plus size={18} /></button>
            </div>
          </div>
          <fieldset className="estimate-margin-presets" aria-label="Margin presets">
            {[1, 1.5, 2, 2.5, 3].map((value) => <label key={value}>
              <input type="radio" name="estimate-margin-preset" aria-label={`Margin ${value} rupees per kg`} value={value} checked={defaultMargin !== "" && Number(defaultMargin) === value} onChange={() => changeMargin(String(value))} />
              <span>{value}</span>
            </label>)}
          </fieldset>
        </div>
      </header>}
      <div className="estimate-tabs" role="tablist" aria-label="Calculator views">
        {[
          { id: "browse", label: "Browse", icon: <Package size={16} /> },
          { id: "quotation", label: "Quotation", count: cart.length, icon: <ClipboardList size={16} /> },
          { id: "selected", label: "Selected", count: cart.length, icon: <CheckCircle2 size={16} /> },
        ].map((tab) => (
          <button type="button" role="tab" key={tab.id} id={`estimate-tab-${tab.id}`}
            aria-selected={view === tab.id} aria-controls={`estimate-panel-${tab.id}`}
            tabIndex={view === tab.id ? 0 : -1}
            onClick={() => changeView(tab.id)}
            onKeyDown={(event) => {
              const tabs = ["browse", "quotation", "selected"];
              const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (!direction && event.key !== "Home" && event.key !== "End") return;
              event.preventDefault();
              const next = event.key === "Home" ? "browse" : event.key === "End" ? "selected"
                : tabs[(tabs.indexOf(tab.id) + direction + tabs.length) % tabs.length];
              changeView(next);
              event.currentTarget.parentElement.querySelector(`#estimate-tab-${next}`).focus();
            }}>
            {tab.icon}<span>{tab.label}</span>{tab.count > 0 && <span className="estimate-tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>
      <div className="estimate-layout">
        <div className="estimate-catalog" role="tabpanel" id="estimate-panel-browse" aria-labelledby="estimate-tab-browse" hidden={view !== "browse"} tabIndex={0}>
          <section aria-labelledby="estimate-categories">
            <div className="estimate-section-heading"><h3 id="estimate-categories">Categories</h3><span>{categories.length} available</span></div>
            <div className="estimate-category-strip" aria-label="Product categories">
              {categories.map((category) => {
                const count = selections.filter((row) => row.categoryId === category.id).length;
                return (
                  <button type="button" className={`estimate-category ${category.id === categoryId ? "active" : ""}`} key={category.id}
                    aria-pressed={category.id === categoryId} onClick={() => { onCategoryChange(category.id); setSearch(""); resetCatalogPage(); }}>
                    <span>{category.name}</span>{count > 0 && <span className="estimate-count">{count}<Check size={12} /></span>}
                  </button>
                );
              })}
            </div>
            {categories.length === 0 && <p className="estimate-empty">No categories available.</p>}
          </section>
          <section className="estimate-products" aria-labelledby="estimate-products-title">
            <div className="estimate-section-heading"><h3 id="estimate-products-title">{activeCategory ? `${activeCategory.name} Items` : "Items"}</h3><span>{activeSizes.length} sizes</span></div>
            <label className="estimate-search"><Search size={18} /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); resetCatalogPage(); }} placeholder="Search sizes" aria-label="Search sizes" /></label>
            <div className="estimate-product-pages" ref={catalogRef} key={`${categoryId}:${search}`} aria-label="Swipeable sizes" onScroll={(event) => {
              const track = event.currentTarget;
              clearTimeout(scrollTimerRef.current);
              scrollTimerRef.current = setTimeout(() => {
                if (!track.isConnected || !track.clientWidth) return;
                const nextPage = Math.max(0, Math.min(pageCount - 1, Math.round(track.scrollLeft / track.clientWidth)));
                catalogPageRef.current = nextPage;
                setCatalogPage(nextPage);
              }, 120);
            }}>
              {Array.from({ length: pageCount }, (_, pageIndex) => <div className="estimate-product-page" key={pageIndex} data-active={pageIndex === currentPage} inert={pageIndex !== currentPage} aria-hidden={pageIndex !== currentPage}>
              <div className="estimate-product-grid">
              {activeSizes.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize).map((size) => {
                const selected = selectedIds.has(size.id);
                const preview = calculatorQuoteItem(activeCategory, size, { itemName: size.name, margin: defaultMargin }, isSalesman, assignedMargin);
                return (
                  <button type="button" key={size.id} className={`estimate-product ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => toggleSize(size)}>
                    <span className="estimate-product-top"><Package size={20} /><span className="estimate-check">{selected ? <Check size={15} /> : <Plus size={15} />}</span></span>
                    <strong>{size.name}</strong><span className="estimate-product-rate">{inr(preview.unitRate)}<small> / kg</small></span>
                  </button>
                );
              })}
              </div>
              </div>)}
            </div>
            {pageCount > 1 && <nav className="estimate-pagination" aria-label="Size pages">
              <button type="button" className="estimate-icon-button" aria-label="Previous sizes" title="Previous sizes" disabled={currentPage === 0} onClick={() => moveCatalogPage(currentPage - 1)}><ArrowLeft size={18} /></button>
              <span aria-live="polite">{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, activeSizes.length)} of {activeSizes.length}</span>
              <button type="button" className="estimate-icon-button" aria-label="Next sizes" title="Next sizes" disabled={currentPage === pageCount - 1} onClick={() => moveCatalogPage(currentPage + 1)}><ArrowRight size={18} /></button>
            </nav>}
            {activeSizes.length === 0 && <p className="estimate-empty">{search ? "No matching sizes." : "No sizes available in this category."}</p>}
          </section>
          {invalidSelection && <p className="estimate-error" role="alert">Check item availability and quantities before adding.</p>}
          <div className="estimate-review-bar"><button type="button" className="estimate-primary" disabled={!selections.length || invalidSelection} onClick={addToQuotation}><Plus size={18} />Add to Quotation{selections.length > 0 && <span className="estimate-count">{selections.length}</span>}<ArrowRight size={18} /></button></div>
        </div>
          <section className="estimate-selection-section" role="tabpanel" id="estimate-panel-selected" aria-labelledby="estimate-tab-selected" hidden={view !== "selected"} tabIndex={0}>
            <div className="estimate-section-heading"><h3 id="estimate-selected-title">Selected Items</h3><span className="estimate-count" aria-live="polite">{reviewSelections.length}</span></div>
            {invalidReview && <p className="estimate-error" role="alert">Check item descriptions, availability and quantities.</p>}
            <div className="estimate-add-bar"><button type="button" className="estimate-primary" disabled={!cart.length || invalidReview} onClick={() => { onUpdate(resolvedReviewSelections.map((selection) => selection.quote)); setView("quotation"); }}><Check size={18} />Update Quotation<ArrowRight size={18} /></button></div>
            {reviewSelections.length === 0 ? <p className="estimate-empty">No items in the quotation.</p> : (
              <div className="estimate-selections">
                {resolvedReviewSelections.map((selection) => (
                  <details className="estimate-selection" key={selection.id}>
                    <summary className="estimate-selection-summary">
                      <span><small>{selection.quote?.category || "Unavailable item"}</small><strong>{selection.itemName || "Untitled item"}</strong></span>
                      <b>{selection.quote ? inr(selection.quote.unitRate) : "Unavailable"}</b><ChevronDown size={16} />
                    </summary>
                    <div className="estimate-selection-editor">
                    <div className="estimate-selection-head"><span><CheckCircle2 size={16} />{selection.quote?.category || "Unavailable item"}</span><button type="button" className="estimate-icon-button" title="Remove selected item" aria-label={`Remove selected ${selection.itemName}`} onClick={() => setReviewSelections((previous) => previous.filter((row) => row.id !== selection.id))}><Trash2 size={17} /></button></div>
                    <label className="estimate-description">Size / Description<input value={selection.itemName} onChange={(event) => editSelection(selection.id, { itemName: event.target.value })} required /></label>
                    {!isSalesman && <div className="estimate-selection-fields">
                      <label>Quantity<input type="number" inputMode="decimal" min="0" step="0.1" placeholder="0" value={selection.qty} onChange={(event) => editSelection(selection.id, { qty: event.target.value })} /></label>
                      <label>Unit<select value={selection.qtyUnit} onChange={(event) => editSelection(selection.id, { qtyUnit: event.target.value })}><option value="kg">kg</option><option value="pcs">pcs</option><option value="bundle">bundle</option></select></label>
                      <label>New margin / kg<input type="number" inputMode="decimal" min="0" step="0.01" placeholder="Unchanged" value={selection.margin} onChange={(event) => editSelection(selection.id, { margin: event.target.value })} /></label>
                    </div>}
                    <div className="estimate-selection-rate"><span>Rate</span><strong>{selection.quote ? inr(selection.quote.unitRate) : "Unavailable"}</strong></div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        <section className="estimate-quotation" role="tabpanel" id="estimate-panel-quotation" aria-labelledby="estimate-tab-quotation" hidden={view !== "quotation"} tabIndex={0}>
          <div className="estimate-section-heading"><h3 id="estimate-quotation-title">Editable Quotation</h3><span>{cart.length} items</span></div>
          <button type="button" className="estimate-review-selected" disabled={!cart.length} onClick={() => changeView("selected")}><CheckCircle2 size={17} />Review items selected<ArrowRight size={17} /></button>
          {cart.length > 0 && <details className="estimate-quote-details"><summary>Quotation items ({cart.length})<ChevronDown size={16} /></summary><div className="estimate-quote-items">{cart.map((item) => <div className="estimate-quote-row" key={item.id}><span><b>{item.itemName}</b><small>{item.category} / {inr(item.unitRate)}{item.qty > 0 ? ` x ${item.qty} ${item.qtyUnit}` : ""}</small></span><button type="button" className="estimate-icon-button" onClick={() => onDeleteRow(item)} title="Delete quotation item" aria-label={`Delete ${item.itemName}`}><Trash2 size={16} /></button></div>)}</div></details>}
          <div className="estimate-share-actions">
            <button type="button" onClick={onCopy} disabled={!quoteText.trim()}><Copy size={17} />Copy</button>
            <button type="button" onClick={onWhatsapp} disabled={!quoteText.trim()}><MessageCircle size={17} />WhatsApp</button>
            <button type="button" onClick={onShare} disabled={!quoteText.trim()}><Send size={17} />Share</button>
          </div>
          <textarea className="estimate-text-editor" aria-label="Editable quotation text" rows={12} value={quoteText} onChange={(event) => onQuoteChange(event.target.value)} placeholder="Your quotation" />
          <div className="estimate-quote-tools"><button type="button" className="estimate-icon-button" title="Print quotation" aria-label="Print quotation" onClick={onPrint}><Printer size={18} /></button><button type="button" className="estimate-icon-button" title="Reset quotation text" aria-label="Reset quotation text" onClick={onReset}><RotateCcw size={18} /></button><button type="button" className="estimate-icon-button" title="Delete all quotation items" aria-label="Delete all quotation items" onClick={onDeleteAll} disabled={!cart.length && !quoteText}><Trash2 size={18} /></button></div>
          <button type="button" className="estimate-order" onClick={onOrder} disabled={!cart.length}>Place Order<ArrowRight size={18} /></button>
        </section>
      </div>
    </div>
  );
}