# Example: concepts, relationships and mappings

For terminology guidance in action, read this example alongside the
[common checks](../editorial-review.md#keep-terms-and-concepts-aligned).

For example, suppose the source distinguishes classes, attributes, relationships,
and mappings. An introduction calling an ontology "a dictionary of concepts and
relationships," followed only by class and attribute examples and then a mapping
definition, leaves the reader to infer how those terms fit together. A coherent
explanation could read:

> An ontology describes business concepts, their attributes, and the relationships
> between concepts. For example, "Member" and "Order" are concepts represented as
> classes. A member's "tier" and an order's "amount" are attributes of those
> concepts. "A member places an order" describes a relationship between them.
> Mapping rules then connect these ontology definitions to actual data: classes
> to tables, attributes to columns, and relationships to join conditions.

Here the relationship connects business concepts; the mapping connects their
definitions to data. That correspondence belongs to this example's assumed source,
not a universal ontology rule. If a source treats relationships as a kind of
property, explain that hierarchy instead. Preserve any useful analogy, but make
its labels correspond to the actual concepts before the explanation relies on them.
