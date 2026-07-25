# Security Role Comparator

A [PPTB](https://github.com/Power-Maverick/PowerPlatformToolBox) tool that lets you compare one security role against up to **5** other roles in the same Dataverse environment—side by side, privilege by privilege.

## Features

- **Side-by-side comparison** – Select a base role and up to 5 comparison roles
- **Solution-scoped role selection** – Pick a solution first, with unmanaged solutions listed before managed solutions
- **Grouped role lists** – Roles are grouped into unmanaged and managed sections, with origin labels to help distinguish custom vs. template/system roles
- **Remembered selections** – Last-used solution and role picks are restored per environment in the browser
- **Entity display + schema names** – Entity rows now show both names, and search matches either one
- **Category grouping** – Privileges are grouped like the OOB role editor (Tables tabs such as Core Records, Business Management, Customization, Custom Entities, Business Process Flows), plus separate Miscellaneous and Privacy-related sections, sourced from the `roleeditorlayout` table
- **Depth visualization** – Four filled/empty dots represent None → User → Business Unit → Parent-Child BU → Organization
- **Directional difference icons** – A green **＋** marks a compared role with *more* permission than the base for a privilege, and a red **－** marks *less*
- **Row filter** – Choose Differences only (default), More than base, Less than base, Same as base, or Show all
- **Entity search** – Filter by entity display name, schema name, or operation (Create, Read, Write, Delete, …)
- **Dark mode** – Follows the PPTB host theme automatically

## Privilege Depth Legend

| Dots | Level | Description |
|------|-------|-------------|
| ○○○○ | None | Privilege not granted |
| ●○○○ | User | Basic (own records) |
| ●●○○ | Business Unit | Local (business unit records) |
| ●●●○ | Parent-Child BU | Deep (business unit + child BU records) |
| ●●●● | Organization | Global (all records) |

Difference icons compare each non-base role's depth against the base role for the same
privilege: a green plus means more permission, a red minus means less.

## Usage

1. Connect to a Dataverse environment in PPTB.
2. Open **Security Role Comparator**.
3. Select a **Solution** from the first dropdown.
4. Select the **Base Role** and one or more **Compare** roles (up to 5 total).
5. Click **Compare**.
6. Use the search box or the row filter dropdown to focus on specific areas.
