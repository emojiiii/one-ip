<script lang="ts">
  import type { Locale } from "../i18n";
  import { t as translate } from "./tools-locale";
  import Fingerprint from "@lucide/svelte/icons/fingerprint";
  import type { CoffeeIp } from "./coffee";
  import { ipProfile } from "./profile";
  import { ipProfileFields } from "./profile-fields";
  let { data, locale }: { data: CoffeeIp; locale: Locale } =
    $props();
  function t(key: string, values: readonly unknown[] = []) {
    return translate(key, values, locale);
  }
  const profile = $derived(ipProfile(data));
  const fields = $derived(ipProfileFields(data, profile));
</script>

<section class="ui-panel">
  <h2>
    <Fingerprint size={16} aria-hidden="true" />{t("profile.title")}
  </h2>
  {#if profile}
    <div class="profile-summary">
      <strong
        >{profile.level ? `${profile.level} · ` : ""}{profile.grade}</strong
      >
      <p>{profile.explanation}</p>
    </div>
    {#if profile.risk}<div class="risk" role="status">
        <strong>{profile.risk.title}</strong>
        <p>{profile.risk.description}</p>
        {#if profile.risk.flags.length}<p>
            {profile.risk.flags.join(" · ")}
          </p>{/if}
      </div>{/if}
    <dl>
      {#each profile.checks as check}<div>
          <dt>{check.label}</dt>
          <dd>{check.value}</dd>
          <small>{check.requirement}</small>
        </div>{/each}
    </dl>
    {#each fields as field}
      <details>
        <summary>{field.label} · {field.value}</summary>{#if field.detail}<p>
            {field.detail}
          </p>{/if}
        <ul>
          {#each field.options as option}<li>
              <strong>{option.current ? "✓ " : ""}{option.label}</strong>
              {option.description}
            </li>{/each}
        </ul>
      </details>
    {/each}
  {/if}
</section>

<style>
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1rem;
    font-weight: 650;
  }
  h2 :global(svg) {
    color: var(--primary);
  }
  .profile-summary {
    margin-block: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--primary-soft);
  }
  .profile-summary strong {
    color: var(--primary);
    font-size: 0.94rem;
  }
  .profile-summary p {
    margin: 3px 0 0;
  }
  p,
  li,
  small {
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--muted-foreground);
  }
  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 145px), 1fr));
    gap: 8px;
  }
  dl div {
    padding: 10px;
    background: var(--muted);
    border-radius: 10px;
  }
  dt {
    font-size: 0.74rem;
    color: var(--muted-foreground);
  }
  dd {
    margin: 4px 0;
    font-size: 0.85rem;
    font-weight: 650;
    overflow-wrap: anywhere;
  }
  small {
    display: block;
  }
  details {
    border-top: 1px solid color-mix(in srgb, var(--border) 66%, transparent);
    padding: 9px 0;
  }
  summary {
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 550;
  }
  summary::marker {
    color: var(--muted-foreground);
  }
  .risk {
    padding: 9px 10px;
    border-radius: 10px;
    color: var(--warning);
    background: var(--warning-soft);
  }
  .risk p {
    margin: 4px 0 0;
  }
</style>
