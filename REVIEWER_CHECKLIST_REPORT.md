# PPTB Reviewer Checklist Assessment Report

**Date**: August 30, 2026  
**Scope**: All tools except ERD Generator  
**Reference**: https://docs.powerplatformtoolbox.com/tool-development/maturity-model#reviewer-checklist

---

## Executive Summary

| Tool                         | Version | Status     | Critical Issues                              |
| ---------------------------- | ------- | ---------- | -------------------------------------------- |
| data-migrator                | 1.0.15  | ⚠️ PARTIAL | ✅ CVEs Fixed, Missing Screenshots           |
| dataverse-trace-analyzer     | 1.0.10  | ⚠️ PARTIAL | ✅ CVEs Fixed, Missing Screenshots           |
| entity-field-catalog         | 1.0.3   | ⚠️ PARTIAL | ✅ CVEs Fixed, Missing Screenshots           |
| pcf-builder                  | 1.0.4   | ⚠️ PARTIAL | ✅ CVEs Fixed, Missing Screenshots           |
| plugin-registration          | 1.0.1   | ⚠️ PARTIAL | ✅ CVEs Fixed, Missing Screenshots           |
| security-role-comparator     | 2.0.0   | ⚠️ PARTIAL | ✅ CVEs Fixed, Missing Screenshots           |
| solution-dependency-analyzer | 0.0.3   | ❌ FAIL    | **VERSION BELOW 1.0.0**, Missing Screenshots |
| view-layout-copier           | 2.0.5   | ⚠️ PARTIAL | ✅ CVEs Fixed, Missing Screenshots           |

---

## Detailed Checklist Results

### 1. DOCUMENTATION (REQUIRED)

#### 1.1 README Quality: UI Screenshots/GIFs and Instructions

**Status**: ⚠️ PARTIAL FAILURE

**Required**: Each README must show the tool UI with a screenshot or GIF, explain what the tool does, and provide installation/run instructions.

**Findings**:

- ✅ **PASS** - All tools have clear descriptions of what they do
- ✅ **PASS** - All tools have installation instructions (npm install, npm run build)
- ✅ **PASS** - All tools have development/run instructions (npm run dev, npm run build)
- ❌ **FAIL** - **Missing Screenshots/GIFs**: All 8 tools lack visual UI screenshots or GIFs in their README files
    - data-migrator: No screenshot
    - dataverse-trace-analyzer: No screenshot
    - entity-field-catalog: No screenshot
    - pcf-builder: No screenshot
    - plugin-registration: No screenshot
    - security-role-comparator: No screenshot
    - solution-dependency-analyzer: No screenshot
    - view-layout-copier: No screenshot

**Action Required**: ✋ **MANUAL** - Add at least one screenshot or GIF showing the tool UI to each README

---

#### 1.2 CSP Exceptions Documentation

**Status**: ✅ PASS

**Required**: For every `cspExceptions` entry, explain why the tool must connect to that external domain.

**Findings**:

- ✅ **data-migrator**: Has `pptb.config.json` with no external domain CSP exceptions
- ✅ **All other 7 tools**: No external CSP exceptions defined (all use PPTB API for Dataverse calls)

---

### 2. CODE & SECURITY (REQUIRED)

#### 2.1 No Critical or High CVEs

**Status**: ✅ PASS (FIXED 2026-08-31)

**Required**: Run `npm audit` and resolve every critical or high-severity vulnerability.

**Findings**: ✅ All HIGH-severity vulnerabilities have been resolved

**Before & After**:
| Tool | Before | After | Changes |
|------|--------|-------|---------|
| data-migrator | 0 Critical, 5 High | **0 Total** ✅ | `npm audit fix --force` applied |
| dataverse-trace-analyzer | 0 Critical, 5 High | **0 Total** ✅ | `npm audit fix --force` applied |
| entity-field-catalog | 0 Critical, 8 High | **0 Total** ✅ | uuid override added, exceljs compatibility maintained |
| pcf-builder | 0 Critical, 9 High | **0 Total** ✅ | `npm audit fix --force` applied |
| plugin-registration | 0 Critical, 4 High | **0 Total** ✅ | `npm audit fix --force` applied |
| security-role-comparator | 0 Critical, 4 High | **0 Total** ✅ | `npm audit fix --force` applied |
| solution-dependency-analyzer | 0 Critical, 5 High | **0 Total** ✅ | `npm audit fix --force` applied |
| view-layout-copier | 0 Critical, 5 High | **0 Total** ✅ | `npm audit fix --force` applied |

**Remediation Details**:

- **7 tools**: Used `npm audit fix --force` to automatically update dev dependencies
- **entity-field-catalog**: Added `overrides` field in package.json to force uuid@^11.1.1 compliance (required by exceljs security fix)
- **All tools**: Updated npm-shrinkwrap.json to lock in fixed versions
- **All tools**: Verified builds complete successfully after fixes

**Previously Vulnerable Packages** (all now updated):

- vite → 6.4.3
- rollup → 4.x with security patches
- postcss → Latest secure version
- picomatch → Fixed version
- nanoid → Updated with secure generators
- minimatch → Fixed ReDoS issues
- brace-expansion → Fixed DoS issues
- tmp → Fixed path traversal

**Action Required**: ✅ COMPLETE - No further action needed

---

#### 2.2 No Deprecated PPTB APIs

**Status**: ✅ PASS

**Required**: Do not call removed or unsupported APIs.

**Findings**:

- ✅ All tools use current PPTB API patterns
- ✅ No deprecated API calls detected
- ✅ All use `window.toolboxAPI` and `window.dataverseAPI` correctly

---

### 3. UI & EXPERIENCE (REQUIRED + OPTIONAL)

#### 3.1 Reacts to PPTB App Theme (Light/Dark Mode) - REQUIRED

**Status**: ✅ PASS

**Required**: Support both light and dark mode without requiring manual configuration.

**Findings**:

- ✅ **data-migrator**: Uses `FluentProvider` with `webDarkTheme` and `webLightTheme`
- ✅ **dataverse-trace-analyzer**: CSS-based dark theme via `body.dark-theme` class
- ✅ **entity-field-catalog**: Uses `FluentProvider` with theme switching
- ✅ **pcf-builder**: CSS-based dark theme via `body.dark-theme` class
- ✅ **plugin-registration**: CSS-based dark theme via `body.dark-theme` class
- ✅ **security-role-comparator**: Uses `FluentProvider` with theme switching
- ✅ **solution-dependency-analyzer**: Uses `FluentProvider` with dual class names
- ✅ **view-layout-copier**: CSS-based dark theme via `body.dark-theme` class

**All tools**:

- Detect current theme via `window.toolboxAPI.utils.getCurrentTheme()`
- Listen for theme change events and apply dynamically
- No manual configuration required

---

#### 3.2 Has an Icon - REQUIRED

**Status**: ✅ PASS

**Required**: Bundle a valid SVG under `dist` and reference it with the top-level `icon` field.

**Findings**:

- ✅ **data-migrator**: `icons/dataMigrator.svg` ✓
- ✅ **dataverse-trace-analyzer**: `icons/traceAnalyzer.svg` ✓
- ✅ **entity-field-catalog**: `icons/fieldCatalog.svg` ✓
- ✅ **pcf-builder**: `icons/pcfBuilder.svg` ✓
- ✅ **plugin-registration**: `icons/prt.svg` ✓
- ✅ **security-role-comparator**: `icons/securityRoleComparator.svg` ✓
- ✅ **solution-dependency-analyzer**: `icons/dependencyAnalyzer.svg` ✓
- ✅ **view-layout-copier**: `icons/layoutReplicator.svg` ✓

All icon paths properly referenced in package.json `icon` field.

---

#### 3.3 Basic Colour Contrast - OPTIONAL

**Status**: 🔍 NOT ASSESSED

Note: This is optional and would require manual visual review in both light and dark themes.

**Action Required**: ✋ **MANUAL** - If desired, review text and interactive controls for contrast in both themes

---

#### 3.4 No Console Errors on Load - OPTIONAL

**Status**: 🔍 NOT ASSESSED

Note: This is optional. Console warnings are acceptable.

**Action Required**: ✋ **MANUAL** - Open browser console during load for each tool to verify no errors appear

---

### 4. VERSIONING (REQUIRED)

#### Version 1.0.0 or Greater

**Status**: ❌ FAILURE (solution-dependency-analyzer)

**Required**: Publish version `1.0.0` or later to signal production readiness.

**Findings**:
| Tool | Version | Status |
|------|---------|--------|
| data-migrator | 1.0.15 | ✅ |
| dataverse-trace-analyzer | 1.0.10 | ✅ |
| entity-field-catalog | 1.0.3 | ✅ |
| pcf-builder | 1.0.4 | ✅ |
| plugin-registration | 1.0.1 | ✅ |
| security-role-comparator | 2.0.0 | ✅ |
| **solution-dependency-analyzer** | **0.0.3** | ❌ **BELOW 1.0.0** |
| view-layout-copier | 2.0.5 | ✅ |

**Action Required**: ✋ **MANUAL** - Update `solution-dependency-analyzer` to version 1.0.0 or higher

```bash
cd tools/solution-dependency-analyzer
npm version minor  # or patch, or major as appropriate
npm run publish-package
```

---

### 5. MAINTENANCE & OWNERSHIP (REQUIRED)

#### 5.1 Healthy Bug Response

**Status**: 🔍 NOT ASSESSED

**Required Thresholds**:

- **PASS**: Fewer than 5 open bugs, maintainer response within 10 days
- **FLAG**: 5+ open bugs or any bug >10 days without response
- **BLOCKER**: Any bug >30 days without response

**Action Required**: ✋ **MANUAL** - Check GitHub Issues for each tool:

- data-migrator
- dataverse-trace-analyzer
- entity-field-catalog
- pcf-builder
- plugin-registration
- security-role-comparator
- solution-dependency-analyzer
- view-layout-copier

Verify that open bug count < 5 and all bugs have maintainer response within 10 days.

---

#### 5.2 Active Contributor

**Status**: ✅ PASS (Visible in package.json)

**Required**: Name at least one reachable, accountable contributor who has been recently active.

**Findings**:

- ✅ All tools list contributors in package.json
- ✅ Primary contributor: "Power Maverick" (https://github.com/Power-Maverick)
- ✅ Most tools list additional contributors
- Note: Verify via git commit history for recency

---

#### 5.3 Up to Date with Breaking Changes

**Status**: ✅ PASS (No deprecated APIs found)

**Required**: Show tool has been updated for breaking PPTB API/dependency changes.

**Findings**:

- ✅ All tools use current PPTB API patterns
- ✅ All use modern dependency versions (React 18, Vite 6, Fluent UI 9)
- ✅ No deprecated API usage detected

---

### 6. USAGE & TRUST SIGNALS (REQUIRED)

#### Meets 2 of 3 Usage Metrics

**Status**: 🔍 NOT ASSESSED

**Required**: Must meet ANY TWO of:

1. **Monthly Active Users (MAU)**: 10 or more
2. **Total Downloads**: 50 or more
3. **Reviews**: At least 1 rated 3 or above

**Note**: New tools may be waived if all other criteria are met and quality is high.

**Action Required**: ✋ **MANUAL** - Check marketplace statistics for each tool or request waiver for new/emerging tools

---

## Summary of Action Items

### 🛑 CRITICAL BLOCKERS (Must Fix Before Verification)

1. ✅ **CVEs in All 8 Tools** - **RESOLVED 2026-08-31**
    - All HIGH severity dev dependencies have been updated
    - All tools now report `found 0 vulnerabilities`
    - npm-shrinkwrap.json files updated and locked

2. **Missing Screenshots in All 8 Tools** - README documentation requirement
    - ⏳ **IN PROGRESS** - User will add GIFs to shared assets folder
    - Next: Add at least one screenshot or GIF to each tool's README showing the UI
    - Place images in a shared assets folder or tool-specific docs folder

3. **solution-dependency-analyzer Version 0.0.3** - Must be ≥ 1.0.0
    - ⏳ **PENDING** - Waiting for user approval
    - Run: `cd tools/solution-dependency-analyzer && npm version minor && npm run publish-package`
    - This must be done before verification request

### ⚠️ MANUAL REVIEW REQUIRED (Lower Priority)

4. **Check GitHub Issues for Each Tool** - Bug response health
    - Verify fewer than 5 open bugs
    - Verify all bugs have maintainer response within 10 days

5. **Verify Usage Metrics** (if applicable)
    - Check marketplace for MAU, downloads, and reviews
    - Or request waiver if new tool meeting other criteria

6. **Optional: Verify Console/Color Contrast** (Optional but recommended)
    - Open each tool in browser
    - Check console for errors (warnings OK)
    - Verify text contrast in light and dark themes

---

## Tools Summary Table

| Criterion           | data-migrator | dataverse-trace | entity-field | pcf-builder | plugin-reg | security-role | solution-dep | view-layout |
| ------------------- | ------------- | --------------- | ------------ | ----------- | ---------- | ------------- | ------------ | ----------- |
| **Version ≥ 1.0.0** | ✅ 1.0.15     | ✅ 1.0.10       | ✅ 1.0.3     | ✅ 1.0.4    | ✅ 1.0.1   | ✅ 2.0.0      | ❌ 0.0.3     | ✅ 2.0.5    |
| **README Quality**  | ⚠️ No IMG     | ⚠️ No IMG       | ⚠️ No IMG    | ⚠️ No IMG   | ⚠️ No IMG  | ⚠️ No IMG     | ⚠️ No IMG    | ⚠️ No IMG   |
| **CSP Documented**  | ✅            | ✅              | ✅           | ✅          | ✅         | ✅            | ✅           | ✅          |
| **No CVEs**         | ✅ 0          | ✅ 0            | ✅ 0         | ✅ 0        | ✅ 0       | ✅ 0          | ✅ 0         | ✅ 0        |
| **Deprecated APIs** | ✅            | ✅              | ✅           | ✅          | ✅         | ✅            | ✅           | ✅          |
| **Theme Support**   | ✅            | ✅              | ✅           | ✅          | ✅         | ✅            | ✅           | ✅          |
| **Has Icon**        | ✅            | ✅              | ✅           | ✅          | ✅         | ✅            | ✅           | ✅          |
| **Bug Health**      | 🔍 Manual     | 🔍 Manual       | 🔍 Manual    | 🔍 Manual   | 🔍 Manual  | 🔍 Manual     | 🔍 Manual    | 🔍 Manual   |
| **Usage Metrics**   | 🔍 Manual     | 🔍 Manual       | 🔍 Manual    | 🔍 Manual   | 🔍 Manual  | 🔍 Manual     | 🔍 Manual    | 🔍 Manual   |

---

## Next Steps

1. ✅ **CVE Fixes Complete** - All 8 tools now have 0 vulnerabilities
2. **Add Screenshots to READMEs** - Prepare GIFs for each tool and add to README files
3. **Update solution-dependency-analyzer Version** - Bump to 1.0.0 or higher
4. **Perform Manual Reviews** - GitHub issues and marketplace metrics
5. **Submit Verification** - Once all blockers are cleared

---

## Change Log (2026-08-31)

**All 8 Tools - CVE Remediation**:

- ✅ Ran `npm audit fix --force` on 7 tools
- ✅ Updated entity-field-catalog with uuid override to resolve exceljs compatibility issue
- ✅ Verified all builds complete successfully
- ✅ Updated all npm-shrinkwrap.json files with fixed versions
- ✅ All tools now report: `found 0 vulnerabilities`

**Modified Files**:

- `tools/data-migrator/npm-shrinkwrap.json` (dependencies updated)
- `tools/dataverse-trace-analyzer/npm-shrinkwrap.json` (dependencies updated)
- `tools/entity-field-catalog/npm-shrinkwrap.json` (dependencies updated + uuid override added)
- `tools/entity-field-catalog/package.json` (added uuid override)
- `tools/pcf-builder/npm-shrinkwrap.json` (dependencies updated)
- `tools/plugin-registration/npm-shrinkwrap.json` (dependencies updated)
- `tools/security-role-comparator/npm-shrinkwrap.json` (dependencies updated)
- `tools/solution-dependency-analyzer/npm-shrinkwrap.json` (dependencies updated)
- `tools/view-layout-copier/npm-shrinkwrap.json` (dependencies updated)

---

**Report Generated**: August 31, 2026 (Updated)
