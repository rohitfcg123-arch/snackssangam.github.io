/*
FILE: js/academic.js
REFERENCE: CMA-ZONE-ACADEMIC-MASTER-V2
PURPOSE: Single source of truth for CMA Syllabus 2022 course, group and paper names used by the tracker.
EDITABLE AREAS: Academic structure and exact paper names.
DEPENDENCIES: None.
IMPORTANT NOTES: Names are based on the supplied ICMAI screenshots and the ICMAI Course Curriculum 2022. Final Electives are separate from Groups III and IV.
LAST UPDATED: 2026-10-04
*/

const ACADEMIC = window.ACADEMIC = {
  foundation: {
    label: "Foundation",
    groups: {
      foundation: [
        ["Paper 1", "Fundamentals of Business Laws and Business Communication (FBLC)"],
        ["Paper 2", "Fundamentals of Financial and Cost Accounting (FFCA)"],
        ["Paper 3", "Fundamentals of Business Mathematics and Statistics (FBMS)"],
        ["Paper 4", "Fundamentals of Business Economics and Management (FBEM)"]
      ]
    }
  },
  inter: {
    label: "Intermediate",
    groups: {
      g1: [
        ["Paper 5", "Business Laws and Ethics (BLE)"],
        ["Paper 6", "Financial Accounting (FA)"],
        ["Paper 7", "Direct and Indirect Taxation (DITX)"],
        ["Paper 8", "Cost Accounting (CA)"]
      ],
      g2: [
        ["Paper 9", "Operations Management and Strategic Management (OMSM)"],
        ["Paper 10", "Corporate Accounting and Auditing (CAA)"],
        ["Paper 11", "Financial Management and Business Data Analytics (FMDA)"],
        ["Paper 12", "Management Accounting (MA)"]
      ]
    }
  },
  final: {
    label: "Final",
    groups: {
      g3: [
        ["Paper 13", "Corporate and Economic Laws (CEL)"],
        ["Paper 14", "Strategic Financial Management (SFM)"],
        ["Paper 15", "Direct Tax Laws and International Taxation (DIT)"],
        ["Paper 16", "Strategic Cost Management (SCM)"]
      ],
      g4: [
        ["Paper 17", "Cost and Management Audit (CMAD)"],
        ["Paper 18", "Corporate Financial Reporting (CFR)"],
        ["Paper 19", "Indirect Tax Laws and Practice (ITLP)"]
      ],
      electives: [
        ["Paper 20A", "Strategic Performance Management and Business Valuation (SPMBV)"],
        ["Paper 20B", "Risk Management in Banking and Insurance (RMBI)"],
        ["Paper 20C", "Entrepreneurship and Startup (ENTS)"]
      ]
    }
  }
};
