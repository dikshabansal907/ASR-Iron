import React, { useState } from "react";
import {
  ArrowRight, Check, CheckCircle2, Copy, MessageCircle, Package,
  Plus, Printer, RotateCcw, Search, Send, Trash2,
} from "lucide-react";
import { asrSortSizes, calculatorQuoteItem, inr } from "./utils";
import "./calculator.css";

export default function CalculatorBrowser({
  categories, sizes, categoryId, onCategoryChange, selections, setSelections,
  isAdmin, isSalesman, assignedMargin, defaultMargin, onDefaultMarginChange,
  onAdd, cart, quoteText, onQuoteChange, onDeleteRow, onDeleteAll,
  onCopy, onWhatsapp, onShare, onPrint, onReset, onOrder,
}) {
  const [search, setSearch] = useState("");
  const activeCategory = categories.find((category) => category.id === categoryId);
  const activeSizes = asrSortSizes(sizes.filter((size) =>
    size.category_id === categoryId && size.name.toLowerCase().includes(search.trim().toLowerCase()),
  ));
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

  function toggleSize(size) {
    setSelections((previous) => previous.some((row) => row.rateItemId === size.id)
      ? previous.filter((row) => row.rateItemId !== size.id)
      : [...previous, {
        rateItemId: size.id, categoryId: size.category_id, itemName: size.name,
        qty: "", qtyUnit: "kg", margin: defaultMargin,
      }]);
  }

  function editSelection(rateItemId, patch) {
    setSelections((previous) => previous.map((selection) =>
      selection.rateItemId === rateItemId ? { ...selection, ...patch } : selection,
    ));
  }

  return (
    <div className="estimate-browser">
      <header className="estimate-heading">
        {isAdmin && (
          <label className="estimate-default-margin">
            Margin
            <span className="estimate-margin-control">
              <span aria-hidden="true">₹</span>
              <input aria-label="Margin per kg" type="number" inputMode="decimal" step="0.01" value={defaultMargin} placeholder="0" onChange={(event) => onDefaultMarginChange(event.target.value)} />
              <span aria-hidden="true">/ kg</span>
            </span>
          </label>
        )}
        <div className="estimate-cart-count" aria-label={`${cart.length} quotation items`} aria-live="polite">
          <span className="estimate-cart-symbol"><Package size={20} aria-hidden="true" /></span>
          <span className="estimate-cart-summary">
            <span className="estimate-cart-label">Quotation</span>
            <strong>{cart.length}<small>{cart.length === 1 ? "item" : "items"}</small></strong>
          </span>
        </div>
      </header>
      <div className="estimate-layout">
        <div className="estimate-catalog">
          <section aria-labelledby="estimate-categories">
            <div className="estimate-section-heading"><h3 id="estimate-categories">Categories</h3><span>{categories.length} available</span></div>
            <div className="estimate-category-strip" aria-label="Product categories">
              {categories.map((category) => {
                const count = selections.filter((row) => row.categoryId === category.id).length;
                return (
                  <button type="button" className={`estimate-category ${category.id === categoryId ? "active" : ""}`} key={category.id}
                    aria-pressed={category.id === categoryId} onClick={() => { onCategoryChange(category.id); setSearch(""); }}>
                    <span>{category.name}</span>{count > 0 && <span className="estimate-count">{count}<Check size={12} /></span>}
                  </button>
                );
              })}
            </div>
            {categories.length === 0 && <p className="estimate-empty">No categories available.</p>}
          </section>
          <section className="estimate-products" aria-labelledby="estimate-products-title">
            <div className="estimate-section-heading"><h3 id="estimate-products-title">{activeCategory ? `${activeCategory.name} Items` : "Items"}</h3><span>{activeSizes.length} sizes</span></div>
            <label className="estimate-search"><Search size={18} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sizes" aria-label="Search sizes" /></label>
            <div className="estimate-product-grid">
              {activeSizes.map((size) => {
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
            {activeSizes.length === 0 && <p className="estimate-empty">{search ? "No matching sizes." : "No sizes available in this category."}</p>}
          </section>
          <section className="estimate-selection-section" aria-labelledby="estimate-selected-title">
            <div className="estimate-section-heading"><h3 id="estimate-selected-title">Selected Items</h3><span className="estimate-count" aria-live="polite">{selections.length}</span></div>
            {selections.length === 0 ? <p className="estimate-empty">No items selected.</p> : (
              <div className="estimate-selections">
                {resolvedSelections.map((selection) => (
                  <article className="estimate-selection" key={selection.rateItemId}>
                    <div className="estimate-selection-head"><span><CheckCircle2 size={16} />{selection.quote?.category || "Unavailable item"}</span><button type="button" className="estimate-icon-button" title="Remove selected item" aria-label={`Remove selected ${selection.itemName}`} onClick={() => setSelections((previous) => previous.filter((row) => row.rateItemId !== selection.rateItemId))}><Trash2 size={17} /></button></div>
                    <label className="estimate-description">Size / Description<input value={selection.itemName} onChange={(event) => editSelection(selection.rateItemId, { itemName: event.target.value })} required /></label>
                    {!isSalesman && <div className="estimate-selection-fields">
                      <label>Quantity<input type="number" inputMode="decimal" min="0" step="0.1" placeholder="0" value={selection.qty} onChange={(event) => editSelection(selection.rateItemId, { qty: event.target.value })} /></label>
                      <label>Unit<select value={selection.qtyUnit} onChange={(event) => editSelection(selection.rateItemId, { qtyUnit: event.target.value })}><option value="kg">kg</option><option value="pcs">pcs</option><option value="bundle">bundle</option></select></label>
                      <label>Margin / kg<input type="number" inputMode="decimal" step="0.01" placeholder="0" value={selection.margin} onChange={(event) => editSelection(selection.rateItemId, { margin: event.target.value })} /></label>
                    </div>}
                    <div className="estimate-selection-rate"><span>Rate</span><strong>{selection.quote ? inr(selection.quote.unitRate) : "Unavailable"}</strong></div>
                  </article>
                ))}
              </div>
            )}
            {invalidSelection && <p className="estimate-error" role="alert">Check item descriptions, availability and quantities.</p>}
            <div className="estimate-add-bar"><button type="button" className="estimate-primary" disabled={!selections.length || invalidSelection} onClick={() => onAdd(resolvedSelections.map((selection) => selection.quote))}><Plus size={18} />Add {selections.length || ""} {selections.length === 1 ? "Item" : "Items"} to Quotation<ArrowRight size={18} /></button></div>
          </section>
        </div>
        <section className="estimate-quotation" aria-labelledby="estimate-quotation-title">
          <div className="estimate-section-heading"><h3 id="estimate-quotation-title">Editable Quotation</h3><span>{cart.length} items</span></div>
          {cart.length > 0 && <div className="estimate-quote-items">{cart.map((item) => <div className="estimate-quote-row" key={item.id}><span><b>{item.itemName}</b><small>{item.category} / {inr(item.unitRate)}{item.qty > 0 ? ` x ${item.qty} ${item.qtyUnit}` : ""}</small></span><button type="button" className="estimate-icon-button" onClick={() => onDeleteRow(item)} title="Delete quotation item" aria-label={`Delete ${item.itemName}`}><Trash2 size={16} /></button></div>)}</div>}
          <textarea className="estimate-quote-editor" aria-label="Editable quotation text" rows={12} value={quoteText} onChange={(event) => onQuoteChange(event.target.value)} placeholder="Your quotation" />
          <div className="estimate-share-actions">
            <button type="button" onClick={onCopy} disabled={!quoteText.trim()}><Copy size={17} />Copy</button>
            <button type="button" onClick={onWhatsapp} disabled={!quoteText.trim()}><MessageCircle size={17} />WhatsApp</button>
            <button type="button" onClick={onShare} disabled={!quoteText.trim()}><Send size={17} />Share</button>
          </div>
          <div className="estimate-quote-tools"><button type="button" className="estimate-icon-button" title="Print quotation" aria-label="Print quotation" onClick={onPrint}><Printer size={18} /></button><button type="button" className="estimate-icon-button" title="Reset quotation text" aria-label="Reset quotation text" onClick={onReset}><RotateCcw size={18} /></button><button type="button" className="estimate-icon-button" title="Delete all quotation items" aria-label="Delete all quotation items" onClick={onDeleteAll} disabled={!cart.length && !quoteText}><Trash2 size={18} /></button></div>
          <button type="button" className="estimate-order" onClick={onOrder} disabled={!cart.length}>Place Order<ArrowRight size={18} /></button>
        </section>
      </div>
    </div>
  );
}