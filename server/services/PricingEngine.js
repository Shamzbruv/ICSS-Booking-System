/**
 * PricingEngine — Multi-Tenant, Per-Tenant Configurable
 *
 * Generalized port of the Windross PricingEngine with a critical difference:
 * instead of reading from a static JSON file, it loads pricing config from the
 * tenant's database record (tenant.branding.pricingConfig) with the Windross
 * config as a hardcoded fallback default.
 *
 * This means each tenant can have their own:
 *   - Service/style catalog & base prices
 *   - Fabric grades & multipliers
 *   - Construction options & premiums
 *   - Size surcharge tiers
 *   - International markup multiplier
 *   - Base currency
 *
 * Usage:
 *   const engine = new PricingEngine(tenant);
 *   const result = engine.calculatePrice(selection, region);
 *
 * Or as a static helper:
 *   const result = PricingEngine.calculate(selection, region, tenant);
 */

// ── Default Pricing Config (Windross baseline) ────────────────────────────────
// Tenants that haven't customized their pricing inherit these values.
const DEFAULT_CONFIG = {
    version:                      '1.0.0',
    baseCurrency:                 'JMD',
    internationalMarkupMultiplier: 1.85,
    exchangeRate_USD_to_JMD:      155,

    styles: {
        suit_2_piece:  { name: '2-Piece Suit',     basePriceJMD: 65000 },
        suit_3_piece:  { name: '3-Piece Suit',     basePriceJMD: 85000 },
        tuxedo:        { name: 'Tuxedo',           basePriceJMD: 75000 },
        jacket_only:   { name: 'Jacket Only',      basePriceJMD: 39000 },
        pants_only:    { name: 'Pants Only',       basePriceJMD: 26000 },
        // Generic service type for non-tailoring tenants
        appointment:   { name: 'Appointment',      basePriceJMD: 0     }
    },

    fabricGrades: {
        'cool-wool':     { multiplier: 1.00, costPerMeterJMD: 6000, priceJMD: 0 },
        'king-wool':     { multiplier: 1.00, costPerMeterJMD: 6000, priceJMD: 0 },
        '2020-material': { multiplier: 1.00, costPerMeterJMD: 6000, priceJMD: 0 },
        'termal-wool':   { multiplier: 1.00, costPerMeterJMD: 6000, priceJMD: 0 },
        'premium':       { multiplier: 1.25, costPerMeterJMD: 8000, priceJMD: 0 },
        'luxury':        { multiplier: 1.50, costPerMeterJMD: 12000, priceJMD: 0 }
    },

    construction: {
        half_canvas: { name: 'Half Canvas',  priceJMD: 0 },
        full_canvas: { name: 'Full Canvas',  priceJMD: 0 }
    },

    options: {},

    sizing: {
        wasteFactor:    0.15,
        baselineMeters: 4.15,
        tiers: {
            XS: { metersNeeded: 3.5, laborScalerJMD: 0    },
            S:  { metersNeeded: 3.7, laborScalerJMD: 0    },
            M:  { metersNeeded: 4.15, laborScalerJMD: 0   },
            L:  { metersNeeded: 4.6, laborScalerJMD: 1500 },
            XL: { metersNeeded: 5.0, laborScalerJMD: 2500 },
            '2X': { metersNeeded: 5.5, laborScalerJMD: 4500 },
            '3X': { metersNeeded: 6.0, laborScalerJMD: 6500 },
            '4X': { metersNeeded: 6.5, laborScalerJMD: 8000 }
        }
    }
};

class PricingEngine {
    /**
     * @param {Object} tenant - The tenant record from the database.
     *   If tenant.branding.pricingConfig exists, it is deep-merged with
     *   DEFAULT_CONFIG so partial configs are supported.
     */
    constructor(tenant = null) {
        const tenantPricingConfig = tenant?.branding?.pricingConfig || {};
        // Deep merge: tenant config overrides defaults at the top-level key level.
        // Individual sub-objects (styles, fabricGrades, etc.) are spread independently
        // so a tenant adding one new style doesn't lose all the defaults.
        this.config = {
            ...DEFAULT_CONFIG,
            ...tenantPricingConfig,
            styles:       { ...DEFAULT_CONFIG.styles,       ...(tenantPricingConfig.styles       || {}) },
            fabricGrades: { ...DEFAULT_CONFIG.fabricGrades, ...(tenantPricingConfig.fabricGrades || {}) },
            construction: { ...DEFAULT_CONFIG.construction, ...(tenantPricingConfig.construction || {}) },
            options:      { ...DEFAULT_CONFIG.options,      ...(tenantPricingConfig.options      || {}) },
            sizing:       {
                ...DEFAULT_CONFIG.sizing,
                ...(tenantPricingConfig.sizing || {}),
                tiers: {
                    ...DEFAULT_CONFIG.sizing.tiers,
                    ...((tenantPricingConfig.sizing || {}).tiers || {})
                }
            }
        };

        this.tenant = tenant;
    }

    /**
     * Re-calculates pricing authoritatively on the backend.
     * Ported 1:1 from Windross PricingEngine.calculatePrice().
     *
     * @param {Object} selection
     *   @param {string}   selection.styleId         - e.g. 'suit_2_piece'
     *   @param {string}   selection.fabricId        - not used for price directly
     *   @param {string}   selection.fabricGrade     - e.g. 'cool-wool'
     *   @param {string}   selection.constructionType - e.g. 'half_canvas'
     *   @param {string[]} selection.options         - array of option IDs
     *   @param {Object}   selection.measurements    - { chest, bust, inputUnit, ... }
     *
     * @param {string} region  - 'INTL' applies international markup, otherwise local
     * @returns {Object} Detailed price breakdown
     */
    calculatePrice(selection, region = 'local') {
        if (!selection) return null;

        const { styleId, fabricGrade, constructionType, options, measurements } = selection;

        let basePriceJMD         = 0;
        let fabricMultiplier     = 1.0;
        let fabricCostPerMeterJMD = 6000;
        let fabricFlatAddJMD     = 0;
        let constructionPriceJMD = 0;
        let optionsPriceJMD      = 0;
        let sizeSurchargeJMD     = 0;

        // 1. Base Price from style
        if (styleId && this.config.styles[styleId]) {
            basePriceJMD = this.config.styles[styleId].basePriceJMD || 0;
        }

        // 2. Fabric grade pricing
        const grade = fabricGrade || 'cool-wool';
        if (this.config.fabricGrades[grade]) {
            fabricMultiplier      = this.config.fabricGrades[grade].multiplier     || 1.0;
            fabricCostPerMeterJMD = this.config.fabricGrades[grade].costPerMeterJMD || 6000;
            fabricFlatAddJMD      = this.config.fabricGrades[grade].priceJMD       || 0;
        }

        const fabricPriceJMD = (basePriceJMD * (fabricMultiplier - 1)) + fabricFlatAddJMD;

        // 3. Construction type premium
        if (constructionType && this.config.construction[constructionType]) {
            constructionPriceJMD = this.config.construction[constructionType].priceJMD || 0;
        }

        // 4. Selected options
        if (options && Array.isArray(options)) {
            options.forEach(optId => {
                if (this.config.options[optId]) {
                    optionsPriceJMD += this.config.options[optId].priceJMD || 0;
                }
            });
        }

        // 5. Size surcharge (based on body measurements)
        const suggestedSize = measurements
            ? this._computeSuggestedSize(measurements)
            : 'M';

        const sizeTier = this.config.sizing.tiers[suggestedSize];
        if (sizeTier) {
            const baselineMeters = this.config.sizing.baselineMeters;
            const wasteFactor    = this.config.sizing.wasteFactor;
            const extraMeters    = Math.max(0, sizeTier.metersNeeded - baselineMeters);
            const extraFabricCost = extraMeters * fabricCostPerMeterJMD;
            const wasteAdd = extraFabricCost * wasteFactor;
            sizeSurchargeJMD = Math.round(extraFabricCost + wasteAdd + (sizeTier.laborScalerJMD || 0));
        }

        const subtotalJMD = basePriceJMD + fabricPriceJMD + constructionPriceJMD + optionsPriceJMD + sizeSurchargeJMD;

        // 6. Region markup
        let appliedMarkupPercent     = 0;
        let regionAdjustedSubtotalJMD = subtotalJMD;

        if (region === 'INTL') {
            const multiplier = this.config.internationalMarkupMultiplier || 1.85;
            regionAdjustedSubtotalJMD = Math.round(subtotalJMD * multiplier);
            appliedMarkupPercent = (multiplier - 1) * 100;
        }

        // 7. Convert to USD/GBP if needed (for international display)
        const exRate = this.config.exchangeRate_USD_to_JMD || 155;
        const totalUSD = regionAdjustedSubtotalJMD / exRate;

        return {
            basePriceJMD,
            fabricPriceJMD:      Math.round(fabricPriceJMD),
            constructionPriceJMD,
            optionsPriceJMD,
            sizeSurchargeJMD,
            subtotalJMD:          Math.round(subtotalJMD),
            regionAdjustedSubtotalJMD,
            totalUSD:             Math.round(totalUSD * 100) / 100,
            suggestedSize,
            appliedMarkupPercent,
            baseCurrency:         this.config.baseCurrency,
            pricingVersion:       this.config.version
        };
    }

    /**
     * Suggest a size from body measurements.
     * Uses chest (or bust) measurement in inches.
     * Ported 1:1 from Windross.
     */
    _computeSuggestedSize(measurements) {
        let chestVal = measurements.chest || measurements.bust;
        let chest    = parseFloat(chestVal);

        // Convert cm to inches if needed
        if (measurements.inputUnit === 'cm') chest = chest / 2.54;

        if (!chest || isNaN(chest)) return 'M';

        if (chest < 36) return 'XS';
        if (chest < 38) return 'S';
        if (chest <= 40) return 'M';
        if (chest <= 44) return 'L';
        if (chest <= 48) return 'XL';
        if (chest <= 52) return '2X';
        if (chest <= 56) return '3X';
        return '4X';
    }

    /**
     * Return the full config for a tenant (merged with defaults).
     * Useful for exposing to the front end to build the UI.
     */
    getConfig() {
        return this.config;
    }

    /**
     * List available styles for this tenant.
     */
    getStyles() {
        return Object.entries(this.config.styles).map(([id, s]) => ({
            id, name: s.name || id, basePriceJMD: s.basePriceJMD
        }));
    }

    /**
     * List available fabric grades for this tenant.
     */
    getFabricGrades() {
        return Object.entries(this.config.fabricGrades).map(([id, f]) => ({
            id, multiplier: f.multiplier, costPerMeterJMD: f.costPerMeterJMD
        }));
    }

    // ── Static convenience method ────────────────────────────────────────────
    /**
     * One-shot pricing calculation for use in route handlers.
     * @example
     *   const result = PricingEngine.calculate(selection, 'INTL', req.tenant);
     */
    static calculate(selection, region, tenant) {
        const engine = new PricingEngine(tenant);
        return engine.calculatePrice(selection, region);
    }
}

module.exports = PricingEngine;
