/**
 * Hubris provider extension for SillyTavern.
 *
 * Adds "Hubris" to the Chat Completion source list, in the "Custom Providers" group.
 * Under the hood it is a Custom (OpenAI-compatible) connection with the Hubris endpoint filled in.
 * The extension only describes the connection. It never connects on its own and never stores or
 * reads a key: the user picks the provider, chooses a key and clicks Connect.
 *
 * Based on https://github.com/SillyTavern/Extension-ProviderExample (AGPL-3.0).
 */

/* global SillyTavern */

/** @typedef {import('../../../custom-providers.js').CustomProviderDefaults} CustomProviderDefaults */
/** @typedef {import('../../../custom-providers.js').ModelSetup} ModelSetup */
/** @typedef {import('../../../custom-providers.js').AuthPolicy} AuthPolicy */
/** @typedef {import('../../../custom-providers.js').CustomProviderControls} CustomProviderControls */
/** @typedef {import('../../../custom-providers.js').Registration} Registration */

// ===== Identity =============================================================
// Do not change the id after release: saved connections refer to it.
const PROVIDER_ID = 'hubris';
const PROVIDER_LABEL = 'Hubris';

// ===== Connection ===========================================================
const API_ROOT = 'https://api.hubris.pw/v1';

/** @type {CustomProviderDefaults} */
const CONNECTION = {
    custom_url: API_ROOT,
    custom_model: '',
    custom_include_headers: '',
    // Reasoning is sent as one `reasoning` object (see adjustRequest), so SillyTavern's own
    // `reasoning_effort` field is removed to keep the two from competing.
    custom_exclude_body: '- reasoning_effort',
    custom_include_body: '',
    custom_prompt_post_processing: '',
};

// ===== Models, key and links ================================================
/** @type {ModelSetup} */
const MODELS = {
    // The list is read from https://api.hubris.pw/v1/models after connecting.
    mode: 'discover',
    suggestions: [
        { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash' },
        { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
        { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5' },
    ],
};

/** @type {AuthPolicy} */
const AUTH = { mode: 'bearer', required: true };

const LINKS = {
    documentationUrl: 'https://hubris.pw/docs',
    supportUrl: 'https://hubris.pw/contact',
    note: 'Get an API key at hubris.pw/keys. Model catalog: hubris.pw/models.',
};

// ===== Settings shown =======================================================
/** @type {CustomProviderControls} */
const CONTROLS = {
    // Replaced by the "Reasoning" input of this extension.
    hide: ['reasoning_effort'],
    show: [],
};

// ===== Own settings =========================================================
const DEFAULT_SETTINGS = {
    reasoning: 'default',
    reasoningBudget: 4096,
};

const REASONING_OPTIONS = [
    { value: 'default', label: 'Default (do not send)' },
    { value: 'off', label: 'Off' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'budget', label: 'Token budget' },
];

// ===== Request adjustment ===================================================

/** Ids of models whose `supported_parameters` include `reasoning`. Filled from the public catalog. */
let reasoningModels = new Set();

/** Reads the public catalog (no key needed). Only used to know which models take `reasoning`. */
async function loadCatalog() {
    try {
        const response = await fetch(`${API_ROOT}/models`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const body = await response.json();
        const ids = (body.data ?? [])
            .filter(model => Array.isArray(model.supported_parameters) && model.supported_parameters.includes('reasoning'))
            .map(model => model.id);
        reasoningModels = new Set(ids);
    } catch (error) {
        console.warn(`${LOG_PREFIX} Could not read the model catalog; the Reasoning input will not be applied.`, error);
    }
}

/**
 * Builds the OpenRouter-style `reasoning` object from the saved settings, or null to send nothing.
 * @param {typeof DEFAULT_SETTINGS} settings
 */
function buildReasoning(settings) {
    switch (settings.reasoning) {
        case 'off':
            return { enabled: false };
        case 'low':
        case 'medium':
        case 'high':
            return { effort: settings.reasoning };
        case 'budget': {
            const budget = Math.trunc(Number(settings.reasoningBudget));
            return Number.isFinite(budget) && budget > 0 ? { max_tokens: budget } : null;
        }
        default:
            return null;
    }
}

/**
 * Runs right before a request is sent, for requests that were built for this provider.
 * @param {object} request The Chat Completion request SillyTavern built
 * @param {typeof DEFAULT_SETTINGS} settings This extension's saved settings
 */
function adjustRequest(request, settings) {
    const reasoning = buildReasoning(settings);
    if (!reasoning || !reasoningModels.has(request.model)) {
        return;
    }
    // Do not clash with an own `reasoning` line from the user's Additional Parameters.
    if (/^\s*reasoning\s*:/m.test(request.custom_include_body ?? '')) {
        return;
    }
    addBodyParameter(request, 'reasoning', reasoning);
}

// ===== You should not need to change anything below =========================

const SETTINGS_KEY = `provider_${PROVIDER_ID}`;
const LOG_PREFIX = `[Provider: ${PROVIDER_LABEL}]`;
/** @type {Registration|null} */
let registration = null;

/** Reads this extension's saved settings, filling in defaults. */
function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    // Filled in place, so the object stays the same one that is saved and handlers can keep it.
    extensionSettings[SETTINGS_KEY] ??= {};
    for (const [name, value] of Object.entries(DEFAULT_SETTINGS)) {
        extensionSettings[SETTINGS_KEY][name] ??= value;
    }
    return extensionSettings[SETTINGS_KEY];
}

/** Whether this provider is the connection that is selected right now. For the interface only. */
function isActive() {
    return Boolean(registration) && SillyTavern.getContext().customProviders.active() === registration.id;
}

/** Adds one field to the request's "Additional Parameters" body for this request only (YAML, JSON is valid). */
function addBodyParameter(request, name, value) {
    const line = `${name}: ${JSON.stringify(value)}`;
    request.custom_include_body = [request.custom_include_body, line].filter(Boolean).join('\n');
}

/**
 * @param {object} request The request SillyTavern built
 * @param {{customProviderId: string|null}} [context] Says which provider the request was built for
 */
function onRequestReady(request, context) {
    // Compare with the request's own provider, not with what is selected now.
    if (registration && context?.customProviderId === registration.id) {
        adjustRequest(request, getSettings());
    }
}

/** Puts the Reasoning inputs into the provider card. SillyTavern empties that area when another connection takes over. */
function renderOwnInputs() {
    const slot = document.getElementById('custom_provider_extension_settings');
    if (!slot || !isActive() || slot.childElementCount) {
        return;
    }

    const settings = getSettings();
    const { saveSettingsDebounced } = SillyTavern.getContext();

    const modeLabel = document.createElement('label');
    modeLabel.textContent = 'Reasoning';
    modeLabel.title = 'Sent as the "reasoning" object, only for models that support it.';
    const select = document.createElement('select');
    select.className = 'text_pole';
    for (const option of REASONING_OPTIONS) {
        select.add(new Option(option.label, option.value));
    }
    select.value = settings.reasoning;
    modeLabel.append(select);

    const budgetLabel = document.createElement('label');
    budgetLabel.textContent = 'Reasoning token budget';
    const budget = document.createElement('input');
    budget.type = 'number';
    budget.min = '1';
    budget.step = '256';
    budget.className = 'text_pole';
    budget.value = String(settings.reasoningBudget);
    budgetLabel.append(budget);
    const syncVisibility = () => budgetLabel.classList.toggle('displayNone', select.value !== 'budget');
    syncVisibility();

    select.addEventListener('change', () => {
        settings.reasoning = select.value;
        syncVisibility();
        saveSettingsDebounced();
    });
    budget.addEventListener('change', () => {
        settings.reasoningBudget = Number(budget.value) || DEFAULT_SETTINGS.reasoningBudget;
        saveSettingsDebounced();
    });

    slot.append(modeLabel, budgetLabel);
}

/** Runs on "activate" and "enable". Both can fire, so registering twice must be harmless. */
export function onActivate() {
    if (registration) {
        return;
    }

    const { customProviders, eventSource, eventTypes } = SillyTavern.getContext();
    if (!customProviders || customProviders.apiVersion !== 1) {
        console.warn(`${LOG_PREFIX} This SillyTavern version does not support Custom providers (API version 1). Nothing was added.`);
        return;
    }

    try {
        registration = customProviders.register(PROVIDER_ID, {
            label: PROVIDER_LABEL,
            defaults: CONNECTION,
            models: MODELS,
            auth: AUTH,
            controls: CONTROLS,
            ...LINKS,
        });
    } catch (error) {
        console.error(`${LOG_PREFIX} Could not register the provider:`, error);
        return;
    }

    eventSource.on(eventTypes.CHAT_COMPLETION_SETTINGS_READY, onRequestReady);
    eventSource.on(eventTypes.CUSTOM_CONNECTION_CHANGED, renderOwnInputs);
    eventSource.on(eventTypes.CHATCOMPLETION_SOURCE_CHANGED, renderOwnInputs);
    renderOwnInputs();
    loadCatalog();
}

/** Runs on "disable", "delete" and "clean". Connections the user saved keep working without the extension. */
export function onDisable() {
    if (!registration) {
        return;
    }

    const { eventSource, eventTypes } = SillyTavern.getContext();
    eventSource.removeListener(eventTypes.CHAT_COMPLETION_SETTINGS_READY, onRequestReady);
    eventSource.removeListener(eventTypes.CUSTOM_CONNECTION_CHANGED, renderOwnInputs);
    eventSource.removeListener(eventTypes.CHATCOMPLETION_SOURCE_CHANGED, renderOwnInputs);
    registration.unregister();
    registration = null;
    document.getElementById('custom_provider_extension_settings')?.replaceChildren();
}
