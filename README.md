<p align="center">
  <img src="assets/hubris-logo-256.png" alt="Hubris" width="96" height="96">
</p>

# Hubris for SillyTavern

Adds **Hubris** to SillyTavern's Chat Completion sources.

[Hubris](https://hubris.pro) is an OpenAI-compatible gateway to hundreds of language models behind one API key, with payment in rubles. This extension registers it as a named provider: the endpoint (`https://api.hubris.pro/v1`), the model list and the key handling are already filled in.

## Requirements

- SillyTavern 1.20.0 or newer. Until that release is out, use the `staging` branch.
- A Hubris API key (starts with `sk-gw-`): <https://hubris.pro/keys>

## Install

1. In SillyTavern, open **Extensions > Install extension**.
2. Paste `https://github.com/Aimagine-life/SillyTavern-Hubris` and confirm.

## Connect

1. Open **API Connections** and set **API** to **Chat Completion**.
2. Under **Chat Completion Source**, pick **Hubris** in the **Custom Providers** group.
3. Enter your API key, or pick one you saved before.
4. Click **Connect**, then choose a model. The list is the live catalog: <https://hubris.pro/models>.

## Settings

| Setting | What it does |
| --- | --- |
| Reasoning | For models that support reasoning, sends the OpenRouter-style `reasoning` object: **Off** (`{"enabled": false}`), **Low / Medium / High** (`{"effort": ...}`) or **Token budget** (`{"max_tokens": ...}`). **Default** sends nothing and the model's own default applies. |

## Good to know

- SillyTavern's own *Reasoning Effort* setting is replaced by the *Reasoning* input above while Hubris is selected.
- The extension never stores or reads your key; SillyTavern keeps it in its own secrets storage.

## Support

- Documentation: <https://hubris.pro/docs>
- Help with this extension or the service: <https://hubris.pro/contact>
- Problems with SillyTavern itself belong in the [SillyTavern issue tracker](https://github.com/SillyTavern/SillyTavern/issues).

## License

AGPL-3.0. Based on the [SillyTavern provider extension example](https://github.com/SillyTavern/Extension-ProviderExample), which is AGPL-3.0.
