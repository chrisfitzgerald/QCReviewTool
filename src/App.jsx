import { useState, useEffect } from 'react';
import styles from './App.module.css';

const TEAM_VERTICALS = [
  'Processing & Imaging',
  'Infrastructure & Platform',
  'Data Transfer',
  'Core Review',
  'Search & Analytics',
  'Privacy Preservation and Collection',
];

function parseNames(input) {
  return input
    .split(/[\n,]+/)
    .map(name => name.trim())
    .filter(Boolean);
}

function assignQCers(qcers, qcTargets) {
  // Shuffle QC Targets
  const shuffled = [...qcTargets].sort(() => Math.random() - 0.5);
  const assignments = {};
  qcers.forEach((qcer) => {
    assignments[qcer] = [];
  });
  const skippedTargets = [];

  shuffled.forEach((qcTarget) => {
    // Find all eligible QCers (not the same as the target)
    const eligibleQCers = qcers.filter(qcer => qcer !== qcTarget);
    if (eligibleQCers.length === 0) {
      skippedTargets.push(qcTarget);
      return;
    }
    // Find the eligible QCer(s) with the fewest assignments
    let minCount = Math.min(...eligibleQCers.map(qcer => assignments[qcer].length));
    const leastLoadedQCers = eligibleQCers.filter(qcer => assignments[qcer].length === minCount);
    // Randomly pick one if there's a tie
    const chosenQCer = leastLoadedQCers[Math.floor(Math.random() * leastLoadedQCers.length)];
    assignments[chosenQCer].push(qcTarget);
  });
  return { assignments, skippedTargets };
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
  const [qcTargetsDraft, setQCTargetsDraft] = useState('');
  const [showHowTo, setShowHowTo] = useState(false);
  const [showTabsMenu, setShowTabsMenu] = useState(false);
  const [isMobileTabs, setIsMobileTabs] = useState(window.innerWidth < 750);

  // Load data for the active tab
  useEffect(() => {
    setLoading(true);
    fetch(`/api/tab-data?tab=${encodeURIComponent(activeTab)}`)
      .then(res => res.json())
      .then(data => {
        setQCersInput((data.qcers || []).join(', '));
        setQCTargetsInput((data.qcTargets || []).join(', '));
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

  const handleAssign = () => {
    const qcers = parseNames(qcersInput);
    const qcTargets = parseNames(qcTargetsInput);
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
    setAssignments(newAssignments);
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
    const qcers = parseNames(qcersInput);
    const qcTargets = parseNames(qcTargetsInput);
    saveTabData(qcers, qcTargets, assignments); // Save current lists, keep assignments unchanged
    setError('Lists saved!');
    setTimeout(() => setError(''), 1500);
  };

  return (
    <>
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
                        const qcers = parseNames(qcersDraft);
                        const qcTargets = parseNames(qcTargetsInput);
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
                          {parseNames(qcersInput).length === 0 ? (
                            <li className={styles.muted}>No QCers listed</li>
                          ) : (
                            parseNames(qcersInput).map((name, idx) => <li key={idx}>{name}</li>)
                          )}
                        </ul>
                      </div>
                      <button onClick={() => {
                        setEditingQCers(true);
                        setQCersDraft(parseNames(qcersInput).join('\n'));
                      }}>Edit</button>
                    </>
                  )}
                </div>
                <div>
                  <label htmlFor="qcTargets">QC Targets</label>
                  {editingQCTargets ? (
                    <>
                      <textarea
                        id="qcTargets"
                        value={qcTargetsDraft}
                        onChange={e => setQCTargetsDraft(e.target.value)}
                        placeholder="e.g. Carol, Dave, Eve"
                      />
                      <button onClick={() => {
                        setQCTargetsInput(qcTargetsDraft);
                        setEditingQCTargets(false);
                        // Persist the new QC Targets list to backend
                        const qcers = parseNames(qcersInput);
                        const qcTargets = parseNames(qcTargetsDraft);
                        saveTabData(qcers, qcTargets, assignments);
                      }} className={styles.marginRight}>Save</button>
                      <button onClick={() => {
                        setEditingQCTargets(false);
                        setQCTargetsDraft(qcTargetsInput);
                      }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <div className={styles.listContainer}>
                        <ul className={styles.noListStyle}>
                          {parseNames(qcTargetsInput).length === 0 ? (
                            <li className={styles.muted}>No QC Targets listed</li>
                          ) : (
                            parseNames(qcTargetsInput).map((name, idx) => <li key={idx}>{name}</li>)
                          )}
                        </ul>
                      </div>
                      <button onClick={() => {
                        setEditingQCTargets(true);
                        setQCTargetsDraft(parseNames(qcTargetsInput).join('\n'));
                      }}>Edit</button>
                    </>
                  )}
                </div>
              </div>
              {/* Right column: Assign button, error, and results */}
              <div className={styles.rightCol}>
                <button onClick={handleAssign} className={styles.maxWidthButton}>Assign QCers</button>
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
                      {Object.entries(assignments).map(([qcer, qcTargets]) => (
                        <li key={qcer} className={styles.assignmentItem}>
                          <strong>{qcer}:</strong>
                          <ul className={styles.assignmentSubList}>
                            {qcTargets.map(qt => (
                              <li key={qt}>{qt}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
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
                <b>View or Edit QCers and QC Targets:</b> QCers are reviewers; QC Targets are those being reviewed.
                Click <b>Edit</b> to modify either list, then <b>Save</b>.
              </li>
              <li>
                <b>Assign QCers:</b> Click <b>Assign QCers</b> to randomly assign reviewers, ensuring no one reviews themselves.
              </li>
              <li>
                <b>Review Assignments:</b> See the assignments and last assigned time on the right.
              </li>
            </ol>
            <ul>
              <li><b>No Self-Review:</b> The tool never assigns someone to review themselves. <b>Note:</b> This check is based on exact text matches between the QCers and QC Targets lists. If there is any difference in spelling, extra spaces, or formatting, the check will not work as expected. Please ensure names are entered consistently in both lists.</li>
              <li><b>Unassigned Targets:</b> If a QC Target can't be assigned, a warning appears.</li>
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