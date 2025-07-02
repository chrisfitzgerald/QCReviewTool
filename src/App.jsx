import { useState, useEffect } from 'react';
import styles from './App.module.css';
import { Analytics } from "@vercel/analytics/next";

const TEAM_VERTICALS = [
  'Processing & Imaging',
  'Infrastructure & Platform',
  'Data Transfer',
  'Core Review',
  'Search & Analytics',
  'Privacy Preservation and Collection',
];

const ROLES = ["AA", "AS", "Senior", "Lead"];
const ROLE_QUOTA = { AA: 5, AS: 5, Senior: 3, Lead: 3 };

function parseQCers(input) {
  return input
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function parseQCTargets(input) {
  // For migration: parse lines like "Name (Role)" or just "Name"
  return input
    .split(/[\n,]+/)
    .map((line) => {
      const match = line.match(/^(.*?)\s*\((AA|AS|Senior|Lead)\)$/i);
      if (match) {
        return { name: match[1].trim(), role: match[2] };
      }
      return { name: line.trim(), role: "AA" };
    })
    .filter((obj) => obj.name);
}

function assignQCers(qcers, qcTargets) {
  // Run the assignment logic up to 10 times, pick the most balanced result
  let bestAssignments = null;
  let bestSkipped = null;
  let bestDiff = Infinity;
  let bestMax = Infinity;
  for (let run = 0; run < 20; run++) {
    // Shuffle QC Targets
    const shuffled = [...qcTargets].sort(() => Math.random() - 0.5);
    const assignments = {};
    qcers.forEach((qcer) => {
      assignments[qcer] = [];
    });
    // Track weighted value per QCer
    const qcerWeighted = Object.fromEntries(qcers.map((q) => [q, 0]));
    const skippedTargets = [];

    shuffled.forEach((qcTarget) => {
      // Exclude self-assignment
      const eligibleQCers = qcers.filter(
        (qcer) => qcer !== qcTarget.name
      );
      if (eligibleQCers.length === 0) {
        skippedTargets.push(qcTarget.name);
        return;
      }
      // Find the eligible QCer(s) with the lowest weighted total
      let minWeighted = Math.min(...eligibleQCers.map((qcer) => qcerWeighted[qcer]));
      const leastLoadedQCers = eligibleQCers.filter((qcer) => qcerWeighted[qcer] === minWeighted);
      // Randomly pick one if there's a tie
      const chosenQCer = leastLoadedQCers[Math.floor(Math.random() * leastLoadedQCers.length)];
      assignments[chosenQCer].push({ name: qcTarget.name, role: qcTarget.role });
      qcerWeighted[chosenQCer] += ROLE_QUOTA[qcTarget.role] || 0;
    });
    const weights = Object.values(qcerWeighted);
    const max = Math.max(...weights);
    const min = Math.min(...weights);
    const diff = max - min;
    if (
      diff < bestDiff ||
      (diff === bestDiff && max < bestMax)
    ) {
      bestAssignments = assignments;
      bestSkipped = skippedTargets;
      bestDiff = diff;
      bestMax = max;
    }
  }
  return { assignments: bestAssignments, skippedTargets: bestSkipped };
}

export default function App() {
  const [activeTab, setActiveTab] = useState(TEAM_VERTICALS[0]);
  const [qcersInput, setQCersInput] = useState('');
  const [qcTargetsInput, setQCTargetsInput] = useState('');
  const [assignments, setAssignments] = useState(null);
  const [lastAssigned, setLastAssigned] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingQCers, setEditingQCers] = useState(false);
  const [editingQCTargets, setEditingQCTargets] = useState(false);
  const [qcersDraft, setQCersDraft] = useState('');
  const [qcTargetsDraft, setQCTargetsDraft] = useState([]);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showTabsMenu, setShowTabsMenu] = useState(false);
  const [isMobileTabs, setIsMobileTabs] = useState(window.innerWidth < 750);
  const [qcTargets, setQCTargets] = useState([]);
  const [animating, setAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);

  // Load data for the active tab
  useEffect(() => {
    setLoading(true);
    fetch(`/api/tab-data?tab=${encodeURIComponent(activeTab)}`)
      .then(res => res.json())
      .then(data => {
        setQCersInput((data.qcers || []).join(', '));
        setQCTargetsInput(
          Array.isArray(data.qcTargets)
            ? data.qcTargets
                .map(q =>
                  typeof q === 'string'
                    ? q
                    : (q && q.name ? `${q.name} (${q.role || 'AA'})` : '')
                )
                .join(', ')
            : ''
        );
        setAssignments(data.assignments || null);
        setLastAssigned(data.lastAssigned || null);
        setError('');
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load data for this tab.');
        setLoading(false);
      });
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileTabs(window.innerWidth < 750);
      if (window.innerWidth >= 750) setShowTabsMenu(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // On load, parse loaded qcTargetsInput (string) to array if needed
  useEffect(() => {
    // If backend returns string, parse; else use as is
    if (typeof qcTargetsInput === "string") {
      setQCTargets(parseQCTargets(qcTargetsInput));
    } else if (Array.isArray(qcTargetsInput)) {
      setQCTargets(qcTargetsInput);
    }
  }, [qcTargetsInput]);

  // Save data to backend
  const saveTabData = (qcers, qcTargets, assignments) => {
    fetch('/api/tab-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tab: activeTab,
        qcers,
        qcTargets,
        assignments,
      }),
    });
  };

  // Animated assignment reveal
  const animateAssignments = async (qcers, qcTargets, assignmentsObj) => {
    setAnimating(true);
    // Prepare empty assignments
    let tempAssignments = {};
    qcers.forEach(qcer => { tempAssignments[qcer] = []; });
    setAssignments({ ...tempAssignments });
    let flat = [];
    Object.entries(assignmentsObj).forEach(([qcer, targets]) => {
      targets.forEach(target => flat.push({ qcer, target }));
    });
    for (let i = 0; i < flat.length; i++) {
      const { qcer, target } = flat[i];
      tempAssignments[qcer] = [...tempAssignments[qcer], target];
      setAssignments({ ...tempAssignments });
      setAnimationProgress(((i + 1) / flat.length) * 100);
      await new Promise(res => setTimeout(res, 200));
    }
    setAnimating(false);
    setAnimationProgress(0);
  };

  const handleAssign = () => {
    const qcers = parseQCers(qcersInput);
    if (qcers.length === 0 || qcTargets.length === 0) {
      setError('Please enter at least one QCer and one QC Target.');
      setAssignments(null);
      return;
    }
    if (qcers.length > qcTargets.length) {
      setError('There should be more QC Targets than QCers.');
      setAssignments(null);
      return;
    }
    setError('');
    const { assignments: newAssignments, skippedTargets } = assignQCers(qcers, qcTargets);
    // Animate the assignment process
    animateAssignments(qcers, qcTargets, newAssignments);
    saveTabData(qcers, qcTargets, newAssignments);
    setLastAssigned(new Date());
    if (skippedTargets.length > 0) {
      setError(
        `Warning: The following QC Target(s) could not be assigned because they are also a QCer and there is no other QCer available: ${skippedTargets.join(', ')}`
      );
    }
  };

  // Save on input change (no longer auto-save)
  const handleQCersInput = (val) => {
    setQCersInput(val);
  };
  const handleQCTargetsInput = (val) => {
    setQCTargetsInput(val);
  };

  // New: Save lists without assigning
  const handleSaveLists = () => {
    const qcers = parseQCers(qcersInput);
    const qcTargets = parseQCTargets(qcTargetsInput);
    saveTabData(qcers, qcTargets, assignments); // Save current lists, keep assignments unchanged
    setError('Lists saved!');
    setTimeout(() => setError(''), 1500);
  };

  // Save handler for table
  const handleSaveQCTargets = () => {
    setQCTargets(qcTargetsDraft);
    setEditingQCTargets(false);
    saveTabData(parseQCers(qcersInput), qcTargetsDraft, assignments);
  };

  // Table row handlers
  const handleQCTargetNameChange = (idx, value) => {
    setQCTargetsDraft((draft) =>
      draft.map((t, i) => (i === idx ? { ...t, name: value } : t))
    );
  };
  const handleQCTargetRoleChange = (idx, value) => {
    setQCTargetsDraft((draft) =>
      draft.map((t, i) => (i === idx ? { ...t, role: value } : t))
    );
  };
  const handleAddQCTarget = () => {
    setQCTargetsDraft((draft) => [...draft, { name: "", role: "AA" }]);
  };
  const handleRemoveQCTarget = (idx) => {
    setQCTargetsDraft((draft) => draft.filter((_, i) => i !== idx));
  };

  return (
    <>
      <Analytics />
      <div className={styles.tabStrip}>
        {isMobileTabs ? (
          <div className={styles.hamburgerMenuWrapper}>
            <button
              className={styles.hamburgerButton}
              onClick={() => setShowTabsMenu((v) => !v)}
              aria-label="Open tab menu"
              type="button"
            >
              <span className={styles.hamburgerIcon}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </div>
        ) : (
          TEAM_VERTICALS.map((vertical) => (
            <button
              key={vertical}
              className={
                activeTab === vertical
                  ? `${styles.tab} ${styles.activeTab}`
                  : styles.tab
              }
              onClick={() => setActiveTab(vertical)}
              type="button"
            >
              {vertical}
            </button>
          ))
        )}
      </div>
      {isMobileTabs && showTabsMenu && (
        <div className={styles.tabsDropdown}>
          {TEAM_VERTICALS.map((vertical) => (
            <button
              key={vertical}
              className={
                activeTab === vertical
                  ? `${styles.tab} ${styles.activeTab}`
                  : styles.tab
              }
              onClick={() => {
                setActiveTab(vertical);
                setShowTabsMenu(false);
              }}
              type="button"
            >
              {vertical}
            </button>
          ))}
        </div>
      )}
      <div className={styles.card}>
        <h1>QC Assignment Tool</h1>
        {loading ? (
          <div className={styles.centered}>Loading...</div>
        ) : (
          <>
            <div className={styles.mainFlex}>
              {/* Left column: QCers and QC Targets lists */}
              <div className={styles.leftCol}>
                <div>
                  <label htmlFor="qcers">QCers</label>
                  {editingQCers ? (
                    <>
                      <textarea
                        id="qcers"
                        value={qcersDraft}
                        onChange={e => setQCersDraft(e.target.value)}
                        placeholder="e.g. Alice, Bob"
                      />
                      <button onClick={() => {
                        setQCersInput(qcersDraft);
                        setEditingQCers(false);
                        // Persist the new QCers list to backend
                        const qcers = parseQCers(qcersDraft);
                        const qcTargets = parseQCTargets(qcTargetsInput);
                        saveTabData(qcers, qcTargets, assignments);
                      }} className={styles.marginRight}>Save</button>
                      <button onClick={() => {
                        setEditingQCers(false);
                        setQCersDraft(qcersInput);
                      }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <div className={styles.listContainer}>
                        <ul className={styles.noListStyle}>
                          {parseQCers(qcersInput).length === 0 ? (
                            <li className={styles.muted}>No QCers listed</li>
                          ) : (
                            parseQCers(qcersInput).map((name, idx) => <li key={idx}>{name}</li>)
                          )}
                        </ul>
                      </div>
                      <button onClick={() => {
                        setEditingQCers(true);
                        setQCersDraft(parseQCers(qcersInput).join('\n'));
                      }}>Edit</button>
                    </>
                  )}
                </div>
                <div>
                  <label>QC Targets</label>
                  {editingQCTargets ? (
                    <>
                      <table className={styles.qcTable}>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {qcTargetsDraft.map((target, idx) => (
                            <tr key={idx}>
                              <td>
                                <input
                                  type="text"
                                  value={target.name}
                                  onChange={e => handleQCTargetNameChange(idx, e.target.value)}
                                  placeholder="e.g. Carol"
                                />
                              </td>
                              <td>
                                <select
                                  value={target.role}
                                  onChange={e => handleQCTargetRoleChange(idx, e.target.value)}
                                >
                                  {ROLES.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <button type="button" onClick={() => handleRemoveQCTarget(idx)}>-</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button type="button" onClick={handleAddQCTarget}>Add Target</button>
                      <button onClick={handleSaveQCTargets} className={styles.marginRight}>Save</button>
                      <button onClick={() => { setEditingQCTargets(false); setQCTargetsDraft(qcTargets); }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <div className={styles.listContainer}>
                        <table className={styles.qcTable}>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Role</th>
                            </tr>
                          </thead>
                          <tbody>
                            {qcTargets.length === 0 ? (
                              <tr><td colSpan={2} className={styles.muted}>No QC Targets listed</td></tr>
                            ) : (
                              qcTargets.map((target, idx) => (
                                <tr key={idx}>
                                  <td>{target.name}</td>
                                  <td>{target.role}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <button onClick={() => { setEditingQCTargets(true); setQCTargetsDraft(qcTargets); }}>Edit</button>
                    </>
                  )}
                </div>
              </div>
              {/* Right column: Assign button, error, and results */}
              <div className={styles.rightCol}>
                <button onClick={handleAssign} className={styles.maxWidthButton} disabled={animating}>
                  {animating ? 'Assigning...' : 'Assign QCers'}
                </button>
                {animating && (
                  <div className={styles.secondaryText} style={{ marginBottom: '1rem' }}>
                    Distributing assignments... {animationProgress.toFixed(0)}%
                  </div>
                )}
                {error && <div className={styles.errorText}>{error}</div>}
                {assignments && (
                  <div className={styles.result}>
                    {lastAssigned && (
                      <div className={styles.secondaryText}>
                        Last assigned: {new Date(lastAssigned).toLocaleString()}
                      </div>
                    )}
                    <h2 className={styles.assignmentHeading}>Assignments</h2>
                    <ul className={styles.noListStyle}>
                      {Object.entries(assignments).map(([qcer, assignedTargets]) => {
                        // Filter out empty assignments
                        const filteredTargets = assignedTargets.filter(({ name }) => name && name.trim() !== "");
                        // Tally by role
                        const roleCounts = {};
                        let weightedTotal = 0;
                        filteredTargets.forEach(({ role }) => {
                          roleCounts[role] = (roleCounts[role] || 0) + 1;
                          weightedTotal += ROLE_QUOTA[role] || 0;
                        });
                        // Build breakdown string
                        const breakdown = Object.entries(roleCounts)
                          .map(([role, count]) => `${count} ${role} = ${count * (ROLE_QUOTA[role] || 0)}`)
                          .join(' + ');
                        return (
                          <li key={qcer} className={styles.assignmentItem}>
                            <strong>{qcer} ({weightedTotal} ticket{weightedTotal !== 1 ? 's' : ''}{breakdown ? `: ${breakdown}` : ''})</strong>:
                            <ul className={styles.assignmentSubList}>
                              {filteredTargets.map(({ name, role }) => (
                                <li key={name + role}>{name} ({role})</li>
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {/* How to Use Button */}
      <button
        className={`${styles.howToButton} ${styles.marginAutoBlock}`}
        onClick={() => setShowHowTo(true)}
      >
        How to Use
      </button>
      {/* Modal Overlay */}
      {showHowTo && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>How to Use the QC Assignment Tool</h2>
            <ol>
              <li>
                <b>Select a Team Vertical:</b> Click a tab at the top to choose the relevant team or project area.
              </li>
              <li>
                <b>View or Edit QCers and QC Targets:</b> QCers are reviewers; QC Targets are those being reviewed.<br/>
                Click <b>Edit</b> to modify either list, then <b>Save</b>.<br/>
                <b>For QC Targets:</b> When editing, you can now select a <b>role</b> (AA, AS, Senior, Lead) for each target using the dropdown next to their name. This role determines the quota weight for assignment balancing.
              </li>
              <li>
                <b>Assign QCers:</b> Click <b>Assign QCers</b> to randomly assign reviewers, ensuring no one reviews themselves.<br/>
                <b>Balanced by Role:</b> The tool will balance assignments so that each QCer receives a fair distribution of targets, taking into account the role quotas (e.g., AA/AS/Senior/Lead). Higher-weighted roles count more toward a QCer's assignment load.
              </li>
              <li>
                <b>Review Assignments:</b> See the assignments and last assigned time on the right. Each QCer's assignment shows the total weighted tickets and a breakdown by role.
              </li>
            </ol>
            <ul>
              <li><b>No Self-Review:</b> The tool never assigns someone to review themselves. <b>Note:</b> This check is based on exact text matches between the QCers and QC Targets lists. If there is any difference in spelling, extra spaces, or formatting, the check will not work as expected. Please ensure names are entered consistently in both lists.</li>
              <li><b>Unassigned Targets:</b> If a QC Target can't be assigned, a warning appears.</li>
              <li><b>Saving Lists:</b> You can save your lists without assigning by clicking <b>Save</b> after editing.</li>
            </ul>
            <button
              className={`${styles.closeModalButton} ${styles.marginTop}`}
              onClick={() => setShowHowTo(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
} 