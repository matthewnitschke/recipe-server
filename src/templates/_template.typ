#let template(
  name: sys.inputs.at("name", default: ""),
  category: sys.inputs.at("category", default: ""),
  body
) = {
  set page(paper: "us-letter")
  set heading(numbering: none)
  show enum.item: it => block(breakable: false)[#it]

  [#metadata((
    name: name,
    category: category,
  )) <recipe-data>]

  heading(level: 1, name)

  body
}

#let ingredient(body) = block(above: 7pt)[
  #text(fill: blue, size: 9pt, style: "italic")[#body]
]
