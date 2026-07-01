function createClaraCoreInnerLifeActions({
  desktop,
  dom,
  state,
  t,
  getSnapshot,
  renderInnerLife,
  refreshRuntimeSnapshotOnly,
  splitListInput,
  itemAgentId
}) {
  function numericValue(input, fallback, parser = Number.parseFloat) {
    const raw = String(input?.value ?? "").trim();
    if (raw === "") return fallback;
    const parsed = parser(raw, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
  }

  async function saveProfile() {
    const agentId = state.activeInnerLifeAgentFilter || "";
    if (!agentId || agentId === "all") {
      if (dom.innerLifeProfileNotice) dom.innerLifeProfileNotice.textContent = t("innerLife.profileSelectAgent");
      return;
    }
    try {
      const profile = JSON.parse(dom.innerLifeProfileJson.value || "{}");
      const stateJson = JSON.parse(dom.innerLifeStateJson.value || "{}");
      const interests = splitListInput(dom.innerLifeProfileInterests.value);
      const sharePolicy = {
        default_mode: profile.share_policy?.default_mode || "when_relevant",
        max_proactive_per_day: numericValue(
          dom.innerLifeProfileShareMaxDaily,
          profile.share_policy?.max_proactive_per_day ?? 3,
          Number.parseInt
        ),
        proactive_after_hours: numericValue(dom.innerLifeProfileShareAfterHours, profile.share_policy?.proactive_after_hours ?? 2),
        repeat_cooldown_hours: numericValue(dom.innerLifeProfileShareCooldownHours, profile.share_policy?.repeat_cooldown_hours ?? 4),
        max_defer_count: profile.share_policy?.max_defer_count ?? 3,
        stale_after_days: profile.share_policy?.stale_after_days ?? 7,
        ...(profile.share_policy || {})
      };
      sharePolicy.max_proactive_per_day = numericValue(
        dom.innerLifeProfileShareMaxDaily,
        sharePolicy.max_proactive_per_day,
        Number.parseInt
      );
      sharePolicy.proactive_after_hours = numericValue(dom.innerLifeProfileShareAfterHours, sharePolicy.proactive_after_hours);
      sharePolicy.repeat_cooldown_hours = numericValue(dom.innerLifeProfileShareCooldownHours, sharePolicy.repeat_cooldown_hours);
      const nextProfile = {
        ...profile,
        share_policy: sharePolicy
      };
      const nextState = {
        ...stateJson,
        current_interests: interests,
        recent_focus: dom.innerLifeProfileRecentFocus.value.trim() || null
      };
      dom.saveInnerLifeProfile.disabled = true;
      if (dom.innerLifeProfileNotice) {
        dom.innerLifeProfileNotice.dataset.locked = "true";
        dom.innerLifeProfileNotice.textContent = t("common.checking");
      }
      await desktop.updateInnerLifeProfile({
        agentId,
        displayName: dom.innerLifeProfileDisplayName.value.trim() || agentId,
        profile: nextProfile,
        state: nextState
      });
      await refreshRuntimeSnapshotOnly();
      if (dom.innerLifeProfileNotice) dom.innerLifeProfileNotice.textContent = t("innerLife.profileSaved");
    } catch (error) {
      console.error(error);
      if (dom.innerLifeProfileNotice) dom.innerLifeProfileNotice.textContent = t("innerLife.profileSaveFailed");
    } finally {
      if (dom.saveInnerLifeProfile) dom.saveInnerLifeProfile.disabled = false;
      if (dom.innerLifeProfileNotice) delete dom.innerLifeProfileNotice.dataset.locked;
      renderInnerLife();
    }
  }

  async function loadMoreCollection({ loadingKey, listKey, totalsKey, pageKey, fetchPage }) {
    const snapshot = getSnapshot();
    if (!snapshot?.innerLife || state[loadingKey]) return;
    state[loadingKey] = true;
    renderInnerLife();
    const agentId = state.activeInnerLifeAgentFilter || "all";
    const currentItems = snapshot.innerLife[listKey] || [];
    const offset =
      agentId === "all"
        ? currentItems.length
        : currentItems.filter((item) => itemAgentId(item) === agentId).length;
    try {
      const page = await fetchPage({ agentId, offset });
      const existingIds = new Set(currentItems.map((item) => item.id));
      snapshot.innerLife[listKey] = [
        ...currentItems,
        ...(page.items || []).filter((item) => !existingIds.has(item.id))
      ];
      state[totalsKey][agentId] = page.total ?? snapshot.innerLife[listKey].length;
      if (agentId === "all") {
        snapshot.innerLife[pageKey] = {
          ...(snapshot.innerLife[pageKey] || {}),
          total: page.total ?? snapshot.innerLife[listKey].length,
          hasMore: Boolean(page.hasMore)
        };
      }
    } catch (error) {
      console.error(error);
    } finally {
      state[loadingKey] = false;
      renderInnerLife();
    }
  }

  function loadMoreSessions() {
    return loadMoreCollection({
      loadingKey: "innerLifeSessionsLoading",
      listKey: "sessions",
      totalsKey: "innerLifeSessionTotals",
      pageKey: "sessionsPage",
      fetchPage: ({ agentId, offset }) => desktop.getInnerLifeSessions({ agentId, limit: 10, offset })
    });
  }

  function loadMoreDigestRuns() {
    return loadMoreCollection({
      loadingKey: "innerLifeDigestRunsLoading",
      listKey: "digestRuns",
      totalsKey: "innerLifeDigestTotals",
      pageKey: "digestRunsPage",
      fetchPage: ({ agentId, offset }) => desktop.getInnerLifeDigestRuns({ agentId, limit: 10, offset })
    });
  }

  function loadMoreInbox() {
    return loadMoreCollection({
      loadingKey: "innerLifeInboxLoading",
      listKey: "inbox",
      totalsKey: "innerLifeInboxTotals",
      pageKey: "inboxPage",
      fetchPage: ({ agentId, offset }) => desktop.getInnerLifeInbox({ agentId, status: "all", limit: 10, offset })
    });
  }

  function bindEvents() {
    dom.saveInnerLifeProfile?.addEventListener("click", () => saveProfile().catch(console.error));
    dom.loadMoreInnerLifeSessions?.addEventListener("click", () => loadMoreSessions().catch(console.error));
    dom.loadMoreInnerLifeDigestRuns?.addEventListener("click", () => loadMoreDigestRuns().catch(console.error));
    dom.loadMoreInnerLifeInbox?.addEventListener("click", () => loadMoreInbox().catch(console.error));
  }

  return {
    bindEvents,
    loadMoreDigestRuns,
    loadMoreInbox,
    loadMoreSessions,
    saveProfile
  };
}

window.createClaraCoreInnerLifeActions = createClaraCoreInnerLifeActions;
