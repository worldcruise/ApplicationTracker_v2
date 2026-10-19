import { randomUUID } from "node:crypto";
export async function testTemplateHTTP({ call, identities, org, candidate, expect }) {
  const url = route => `${route}?organizationId=${org}`; const m = identities.memberA;
  const templates = await call(m, url("/templates") + `&candidateId=${candidate}`); expect(templates.status === 200 && templates.data.filter(t => t.scope === "builtin").length === 9, "All nine built-in template presets available");
  const base = templates.data.find(t => t.name === "Modern Professional");
  const body = { presetId: null, baseVersionId: base.id, name: "Synthetic custom template", scope: "candidate", sharing: "team", teamId: null, candidateId: candidate, layout: { ...base.layout, margin: 54, labels: { ...base.layout.labels, summary: "Synthetic profile" } } };
  expect((await call(m, url("/templates/versions"), { ...body, scope: "organization", sharing: "organization", candidateId: null }, 0)).status === 403, "Member cannot publish organization template");
  expect((await call(m, url("/templates/versions"), { ...body, layout: { ...body.layout, fontSize: 3 } }, 0)).status === 422, "Unsafe template typography rejected");
  const first = await call(m, url("/templates/versions"), body, 0); expect(first.status === 200, `Member duplicates template in authorized candidate scope (${first.status}, ${first.code ?? "OK"})`);
  const list = await call(m, url("/templates") + `&candidateId=${candidate}`); const custom = list.data.find(t => t.id === first.data.id);
  const profile = await call(m, `/candidates/${candidate}?organizationId=${org}`);
  const assembled = await call(m, url("/prompt-assemblies"), { candidateId: candidate, profileRevision: profile.data.rowVersion, templateVersionId: custom.id, job: { company: "Synthetic Template Target", title: "Engineer", description: "Synthetic job" } });
  expect(assembled.status === 200 && assembled.data.templateVersionId === custom.id && assembled.data.templateSnapshot.layout.margin === 54, "Prompt assembly freezes selected template version/layout");
  const content = { company: "Synthetic Template Target", title: "Engineer", summary: profile.data.professionalSummary, skills: [], experience: profile.data.experiences.map(w => ({ title: w.officialTitle, company: w.company, sentences: w.sourceBullets })), education: profile.data.educations.map(e => ({ degree: [e.degree, e.fieldOfStudy].filter(Boolean).join(" in ") })) };
  const review = { experienceIds: profile.data.experiences.map(w => w.id), educationIds: profile.data.educations.map(e => e.id), claims: {} }; const renderedAt = "2026-10-19T10:00:00.000Z";
  const rendered = await call(m, url("/resume-renders"), { assemblyId: assembled.data.id, rawJson: JSON.stringify(content), review, renderedAt }); expect(rendered.status === 200 && rendered.data.rendererVersion === "template-engine/2.0.0", "Configured template renders with pinned engine");
  const payload = { operationId: randomUUID(), assemblyId: assembled.data.id, schemaVersion: 1, rawJson: JSON.stringify(content), review, render: { sha256: rendered.data.sha256, pageCount: rendered.data.pageCount, rendererVersion: rendered.data.rendererVersion, renderedAt } };
  const saved = await call(m, url("/resume-versions"), payload, undefined, { "Idempotency-Key": payload.operationId }); expect(saved.status === 200, "Configured resume source persists");
  expect((await call(m, url("/templates/versions"), { ...body, presetId: custom.presetId, layout: { ...body.layout, margin: 60 } }, 1)).status === 200, "Template editing appends new immutable version");
  const old = await call(m, url(`/resume-versions/${saved.data.id}/pdf`)); expect(old.status === 200 && old.data.base64 === rendered.data.base64, "Later template version cannot change historical PDF bytes");
  expect((await call(identities.leaderBeta, url("/templates") + `&candidateId=${candidate}`)).status === 403, "Unrelated team cannot inspect candidate-scoped templates");
  const direct = await m.client.from("template_versions").update({ name: "forbidden" }).eq("id", custom.id); expect(direct.error?.code === "42501", "Published template direct mutation denied");
  return { sourceId: saved.data.id, candidate, templateId: custom.id };
}
