# Ohm TODO

## First Release Blockers

### Better error messages

Implement Alex's de-spockification idea.

#### Unit tests

In the following unit tests, I've added suffixes to each rule application so that each one can be written unambiguously in the "stacks". This matters b/c we want to know what the "continuation" of a recorded failure would have been -- which means that we must know which application of a rule `r` caused the failure, if there is more than one.

##### Unit test #1

```
start = addExp#1
addExp = addExp#2 "+" mulExp#1 | mulExp#2
mulExp = mulExp#3 "*" priExp#1 | priExp#2
priExp = number
```

If the input is `"1-"`, the failed primitives recorded at position `1` should be:

* `"*"`, with stack `start > addExp#1 > mulExp#2`
* `"+"`, with stack `start > addExp#1`

The expected set should be {`"*"`, `"+"`}.

For more info, memo @ `0`:

* `start` -> FAIL, w/ failures@`1`:
    * `"+"`, `addExp#1`
    * `"*"`, `addExp#1 > mulExp#2`
* `addExp` -> SUCCESS@`1` w/ failures@`1`:
    * `"+"`, (empty stack)
    * `"*"`, `mulExp#2`
* `mulExp` -> SUCCESS@`1` w/ failures@`1`:
    * `"*"`, (empty stack)

|::|::|::|
| **subsumes**  | (`"+"`, `start > addExp#1`) | (`"*"`, `start > addExp#1 > mulExp#2`) |
| `+` | N | N |
| `*` | N  | N |
| `+` or `*` | N  | N |

##### Unit test #2

```
start = addExp#1 ";"
addExp = addExp#2 "+" mulExp#1 | mulExp#2
mulExp = mulExp#3 "*" priExp#1 | priExp#2
priExp = number
```

If the input is `"1"`, the failed primitives recorded at position `1` should be:

* `"*"`, with stack `start > addExp#1 > mulExp#2`
* `"+"`, with stack `start > addExp#1`
* `";"`, with stack `start`

The expected set should be {`";"`}.

|::|::|::|::|
| **subsumes**  | (`";"`, `start`) | (`"+"`, `start > addExp#1`) | (`"*"`, `start > addExp#1 > mulExp#2`) |
| `;` | N | Y | Y |
| `+` | N  | N | N |
| `*` | N  | N | N |
| `;`, `+` or `*` | N  | Y | Y |

##### Unit test #3

```
start = a#1 b#1 | b#2 a#2
a = "a"
b = "b"
```

If the input is `""`, the failed primitives recorded at position `0` should be:

* `"a"`, with stack `start > a#1`
* `"b"`, with stack `start > b#2`

The expected set should be {`"a"`, `"b"`}.

##### Unit test #4

```
start = a#1 b#1 | a#2 | b#2 a#3
a = "a"
b = "b"
```

If the input is `""`, the failed primitives recorded at position `0` should be:

* `"a"`, with stacks `start > a#1` and `start > #a2`
* `"b"`, with stack `start > #b2`

The expected set should be {`"a"`, `"b"`}.

**TODO:** I added this example because it's important to consider the case when a terminal can be reached in different ways (i.e., w/ different stacks). Unfortunately in this case that doesn't make a difference. I'd like to find an example where it does.

Straw man: when a terminal has more than one stack in a `FailureDescriptor`, we should only exclude it from the expected set if there is one or more entry (terminal) that subsumes it, i.e., considering all of its stacks / continuations. To say it in a different way: the subsuming terminal must be on the path to acceptance considering all of the stacks.

##### Unit test #5

```
Start = c#1 "sucks" | c#2 "stinks"
c = "C" "++"?
```

If the input is `"C rules"`, the recorded failed primitives at position `2` should be:

* `"++"`, with stack `start > c#1`
* `"sucks"`, with stack `start`
* `"stinks"`, with stack `start`

The expected set should be {`"sucks"`, `"stinks"`}.


### "Namespaces"

* `ohm.grammar(stringOrNodeList, optNS)` returns a `Grammar`
* `ohm.grammars(stringOrNodeList, optNS)` returns a namespace
* Namespaces are just JS objects mapping grammar names to `Grammar` objects.
* If the `stringOrNodeList` argument is a `NodeList`, it must only contain `<script>` tags whose `type` attribute is set to `text/ohm-js`.
* Grammars that are used as super-grammars in grammar declarations should be looked up in the `optNS` dictionary, if there is one.
* The `ohm.grammars()` method should create a new namespace object in which it should put all of the grammars it creates. Lookup for super-grammars should start in that object, and if there's no match, it should go to the `optNS` object, if present.
* You can't re-declare a grammar -- that's an error. This could happen with `ohm.grammar()` if the grammar is already declared in `optNS`, and in `ohm.grammars()` if the grammar is already in the new namespace, or in `optNS`.
* After doing this stuff, we should be able to:
    * Remove the stuff having to do with `Namespaces` from the codebase.
    * In `src/ohm-grammar.ohm`, remove `SuperGrammar_qualified` rule
    * No more `namespace` attribute in Ohm `<script>` tags.
    * Maybe now the stuff that's done in `src/bootstrap.js` can be done for any grammar? That would enable people to share grammar as "binaries". (A while ago I had an `ohm` command, but I removed it b/c it didn't support inheritance properly. That command turned into the less general but essential `src/bootstrap.js`.)

### Inheriting from Operations and Attributes

To enable extensibilty, operations and attributes should always belong to an instance of `Semantics`. Here's how this might work:

```
var g1 = ohm.grammar(...);
var s1 = g1.createSemantics()
  .addOperation('eval', {
  	AddExp_plus: function(x, _, y) {
  	  return x.eval() + y.eval();
  	...
```

Note that `Semantics.prototype.addOperation(name, dict)` returns the receiver to allow chaining. (Same goes for `Semantics.prototype.addSynthesizedAttribute` and `Semantics.prototype.addInheritedAttribute`.)

The `Semantics` objects act as a family of operations and attributes. Recursive (even mutually-recursive) uses of operations / attributes go through "wrapper objects" that hold a reference to an instance of `Semantics` as well as a CST node, which may be accessed via the wrapper's `node` property. (This avoids the problems I was having with early-binding in recursive calls, which were getting in the way of extensibility.) Operations are called as methods of the wrapper objects, while synthesized attributes are accessed as properties.

**TODO:**

* Figure out how operations and attributes will be used *outside* of their definitions. Our current thinking is that they will look like methods of their corresponding `Semantics` object, e.g., `s1.eval(g1.matchContents(...))` and `s1.value(g1.matchContents(...))`.
* Improve the API for defining inherited attributes.

To extend an operation or an attribute, you create a new `Semantics` object that  extends the `Semantics` the the operation or attribute in question belongs to. You do this by passing the `Semantics` that you want to extend as an argument to *your grammar*'s `createSemantics` method. Then you call `extend(operationOrAttributeName, dict)` on that. E.g.,

```
var g2 = ... // some grammar that extends g1
var s2 = g2.createSemantics(s1)
  .extend("eval", {
  	AddExp_foo: function(x, _, y) { ... }
```

A *derived* `Semantics` instance -- i.e., one that is created by passing an existing `Semantics` to `Grammar.prototype.createSemantics()` -- automatically inherits all of the operations and attributes from the parent `Semantics`.

#### Error conditions

`Grammar.prototype.createSemantics(parentSemantics)` creates a new instance of `Semantics` that inherits all of the operations and attributes from `parentSemantics`. **Note that all of the inherited operations and attributes that haven't been `extend`ed explicitly must go through the *arity* and *superfluous method* checks the first time any of the operations or attributes of the "child" `Semantics` is used.**

`Semantics.prototype.extend(name, dict)` should throw an error if:

* The receiver did not inherit an operation or attribute called `name` from its parent.
* The operation or attribute called `name` has already been `extend`ed in the receiver.
* One or more of `dict`'s methods are *superfluous* (i.e., do not correspond to a rule in the receiver's grammar) or have the wrong arity.

`Semantics.prototype.addOperation(name, dict)`,
`Semantics.prototype.addSynthesizedAttribute(name, dict)`, and
`Semantics.prototype.addInheritedAttribute(name, dict)` should throw an error if:

* The receiver already has an operation or attribute with the same name.
* One or more of `dict`'s methods are *superfluous* (i.e., do not correspond to a rule in the receiver's grammar) or have the wrong arity.
* It should also be an error to try to declare a new operation or attribute whose name is `node` (see below).

### Unit Tests

* The unit tests are a mess right now. They were pretty good early on, but the language has been changed a lot since then. **We should spend a couple of days cleaning up the unit tests.** E.g.,
    * Now that we have CSTs, there's no reason to check acceptance and semantic actions separately for each kind of `PExpr`. We should just compare the result of `Grammar.prototype.match` with the expected CST. (We may have to do some work to get `Node.equals(anotherNode)` to work.)
    * ...

### Refactorings

* Pass origPos, etc., as arguments to `PExpr.prototype._eval`

### Documentation

* Write it.

## Things that should be included in future releases

* Pat's visualizer / omniscient debugger
* An IDE for Ohm
    * Integrate Pat's visualizer
    * Built-in support for unit testing grammars (re-run unit tests while programmer changes the grammar, show coverage, etc.)
    * Automatic generation of random valid inputs
* Better support for attribute grammars
    * Take another pass at the API for writing inherited attributes
    * Akira's editor?
* Using persistent data structures (ImmutableJS?) for parsing contexts, so that adding that extra key to the memo table won't be so expensive.
* Incremental parsing ala [Papa Carlo](http://lakhin.com/projects/papa-carlo/)?    