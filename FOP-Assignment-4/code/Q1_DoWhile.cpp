/*
 * Assignment 4 - Question 1 (do-while version)
 * Purpose : Display the sentence "I Love Programming" 30 times
 *           using a do-while loop.
 */
#include <iostream>
using namespace std;

int main()
{
    const int TIMES = 30;   // number of times to display the sentence
    int count = 1;          // loop counter

    // do-while: the body runs first, then the condition is checked
    do
    {
        cout << "I Love Programming" << endl;
        count++;
    } while (count <= TIMES);

    return 0;
}
