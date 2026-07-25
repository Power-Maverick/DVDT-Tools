# Security Role Comparator

A [PPTB](https://github.com/Power-Maverick/PowerPlatformToolBox) tool that lets you compare one security role against up to **5** other roles in the same Dataverse environment—side by side, privilege by privilege.

## Features

- **Side-by-side comparison** – Select a base role and up to 5 comparison roles
- **Grouped role lists** – Roles are grouped into Unmanaged and Managed sections; same-named roles are disambiguated by business unit
- **Remembered selections** – Last-used base and comparison role picks are restored per environment in the browser
- **Entity display + schema names** – Entity rows show both names, and search matches either one
- **Category grouping** – Privileges are grouped like the OOB role editor (Tables tabs such as Core Records, Business Management, Customization, Custom Entities, Business Process Flows), plus separate Miscellaneous and Privacy-related sections, sourced from the `roleeditorlayout` table
- **Depth visualization** – Each privilege depth is shown with an icon mirroring the Dataverse security-role editor (None, User, Business Unit, Parent-Child BU, Organization)
- **Directional difference icons** – A green **＋** marks a compared role with *more* permission than the base for a privilege, and a red **－** marks *less*
- **Row filter** – Choose All differences (default), More than base, Less than base, Same as base, or Show all
- **Group & operation filters** – Multi-select dropdowns (each with an *All* shortcut to select/clear everything) to focus on specific groups (Core Records, Business Management, …) and operations (Create, Read, Write, Delete, Append, Append To, Assign, Share, and Enable for non-table privileges)
- **Entity search** – Filter by entity display name, schema name, or operation (Create, Read, Write, Delete, …)
- **Dark mode** – Follows the PPTB host theme automatically

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
5. Use the search box, group/operation filters, or the row filter dropdown to focus on specific areas.
