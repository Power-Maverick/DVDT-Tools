# Security Role Comparator

A [PPTB](https://github.com/Power-Maverick/PowerPlatformToolBox) tool that lets you compare one security role against up to **5** other roles in the same Dataverse environment—side by side, privilege by privilege—and see the **combined** permission a user would have if granted all of them.

## Features

### Role selection
- **Side-by-side comparison** – Pick a base role and up to 5 comparison roles.
- **Grouped role lists** – Roles are grouped into **Unmanaged** and **Managed** sections; roles that share a name are disambiguated by business unit.
- **Set as Base** – Each comparison column has a **(Set as Base)** link that swaps that role with the base role and re-runs the comparison in place.
- **Remembered selections** – Your last-used base and comparison roles are restored per environment.

### Privilege grid
- **Category grouping** – Privileges are grouped like the built-in security role editor: **Tables** tabs (Core Records, Business Management, Customization, Custom Entities, Business Process Flows, …) plus separate **Miscellaneous** and **Privacy Related** sections, sourced from the `roleeditorlayout` table.
- **Entity display + schema names** – Table rows show both the entity display name and its schema name.
- **Accurate privilege mapping** – Privileges are mapped to their table and operation from table metadata (`EntityDefinitions.Privileges`), so tables whose privilege names don't match their logical name (for example **SystemUser** and **Activity**) and `AppendTo` privileges are categorized correctly.
- **Depth icons** – Each privilege depth is shown with an icon that mirrors the Dataverse security-role editor (None, User, Business Unit, Parent-Child BU, Organization).
- **Directional difference icons** – In each comparison column, a green **＋** marks *more* permission than the base for that privilege and a red **－** marks *less*; cells that match the base are de-emphasized so real differences stand out.

### Filtering
- **Row filter** – All differences (default), More than base, Less than base, Same as base, Show all, or **Combined Permission** (see below).
- **Group & Operation filters** – Multi-select dropdowns, each with an **All** shortcut, to focus on specific groups (Core Records, Business Management, …) and operations. Operations follow the canonical order **Create, Read, Write, Delete, Append, Append To, Assign, Share** (with **Enable** used for non-table privileges).
- **Search** – Matches entity display name, schema name, operation, or the raw privilege name.
- **Dark mode** – Follows the PPTB host theme automatically.

## Combined Permission

Selecting **Combined Permission** from the row-filter dropdown answers a common question:

> *If a user were assigned the base role **and** every comparison role, what could they actually do?*

When enabled:

- A virtual **Combined Permission** column is appended to the right of the comparison columns (shown with a subtle green tint to indicate it is derived, not a real role).
- For every privilege, the combined value is the **highest permission granted by any** of the selected roles (base + all comparisons). This reflects how Dataverse security is additive — a user's effective access for a privilege is the broadest scope any of their roles grants.
- The grid is filtered to only the privileges whose combined permission is **above None** (i.e. the privileges the user would actually hold), still honoring any active **Group** and **Operation** filters.

Depth precedence used for the combination (lowest to highest):

**None → User → Business Unit → Parent-Child Business Unit → Organization**

## Privilege Depth Legend

Each depth level is represented with a Fluent icon that mirrors the built-in Dataverse
security-role editor:

| Icon | Level | Description |
|------|-------|-------------|
| 🚫 Prohibited | None | Privilege not granted |
| 👤 Person | User | Basic (own records) |
| 👥 People | Business Unit | Local (business unit records) |
| 👨‍👩‍👧 People team | Parent-Child BU | Deep (business unit + child BU records) |
| 🏢 Organization | Organization | Global (all records) |

Difference icons compare each non-base role's depth against the base role for the same
privilege: a green plus means more permission, a red minus means less.

## Usage

1. Connect to a Dataverse environment in PPTB.
2. Open **Security Role Comparator**.
3. Select the **Base Role** and one or more **Compare** roles (up to 5 total).
4. Click **Compare**.
5. Use the search box, the **Group**/**Operation** filters, or the row-filter dropdown to focus on specific areas.
6. Choose **Combined Permission** in the row-filter dropdown to see the net effective permission across all selected roles.
